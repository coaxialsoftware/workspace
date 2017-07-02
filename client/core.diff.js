/**
 * @license
 * Adapted from fast-diff library.
 * 
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function(ide) {
"use strict";
/* jshint maxdepth: 5 */

/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
const
	DIFF_DELETE = -1,
	DIFF_INSERT = 1,
	DIFF_EQUAL = 0,
	MINL = 5
;
	
/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2)
{
	// Check for equality (speedup).
	if (text1 === text2)
		return text1 ? [DIFF_EQUAL, text1] : [];

	// Trim off common prefix (speedup).
	var commonlength = diff_commonPrefix(text1, text2);
	var commonprefix = text1.slice(0, commonlength);
	
	text1 = text1.slice(commonlength);
	text2 = text2.slice(commonlength);

	// Trim off common suffix (speedup).
	commonlength = diff_commonSuffix(text1, text2);
	var commonsuffix = text1.slice(text1.length - commonlength);
	text1 = text1.slice(0, text1.length - commonlength);
	text2 = text2.slice(0, text2.length - commonlength);

	// Compute the diff on the middle block.
	var diffs = diff_compute_(text1, text2);

	// Restore the prefix and suffix.
	if (commonprefix) diffs.unshift(DIFF_EQUAL, commonprefix);
	if (commonsuffix) diffs.push(DIFF_EQUAL, commonsuffix);
	
	diff_cleanupMerge(diffs);
	
	return diffs;
}


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
	var diffs;

	// Just add some text (speedup).
	if (!text1) return [DIFF_INSERT, text2];

	// Just delete some text (speedup).
	if (!text2) return [DIFF_DELETE, text1];

var
	longtext = text1.length > text2.length ? text1 : text2,
	shorttext = text1.length > text2.length ? text2 : text1,
	i = longtext.indexOf(shorttext)
;
	if (i !== -1) {
		// Shorter text is inside the longer text (speedup).
		diffs = [DIFF_INSERT, longtext.slice(0, i),
				 DIFF_EQUAL, shorttext,
				 DIFF_INSERT, longtext.slice(i + shorttext.length)];
		// Swap insertions for deletions if diff is reversed.
		if (text1.length > text2.length) diffs[0] = diffs[4] = DIFF_DELETE;
		
		return diffs;
	}

	// Single character string.
	// After the previous speedup, the character can't be an equality.
	if (shorttext.length === 1)
		return [DIFF_DELETE, text1, DIFF_INSERT, text2];

	// Check to see if the problem can be split in two.
	var hm = diff_halfMatch_(text1, text2);

	if (hm) {
		// A half-match was found, sort out the return data.
		// Send both pairs off for separate processing.
		var diffs_a = diff_main(hm[0], hm[2]), diffs_b = diff_main(hm[1], hm[3]);
		// Merge the results.
		return diffs_a.concat([DIFF_EQUAL, hm[4]], diffs_b);
	}

	return diff_bisect_(text1, text2);
}

/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
const
	text1_length = text1.length,
	text2_length = text2.length,
	max_d = Math.ceil((text1_length + text2_length) / 2),
	v_offset = max_d,
	v_length = 2 * max_d,
	delta = text1_length - text2_length,
	front = (delta % 2 !== 0),
	v1 = new Int16Array(v_length),
	v2 = new Int16Array(v_length)
;
	v1[v_offset + 1] = 0;
	v2[v_offset + 1] = 0;
	
	// If the total number of characters is odd, then the front path will collide
	// with the reverse path.
	// Offsets for start and end of k loop.
	// Prevents mapping of space beyond the grid.
var
	k1start = 0, k1end = 0, k2start = 0, k2end = 0,
	k2_offset, x2, x1, y1, k1_offset, d, k1, k2, y2
;
	for (d = 0; d < max_d; d++) {
    // Walk the front path one step.
		for (k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
			k1_offset = v_offset + k1;
			if (k1 === -d || (k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
				x1 = v1[k1_offset + 1];
			} else {
				x1 = v1[k1_offset - 1] + 1;
			}
			y1 = x1 - k1;
			while (x1 < text1_length && y1 < text2_length &&
				   text1[x1] === text2[y1]) {
				x1++;
				y1++;
			}
			v1[k1_offset] = x1;
			if (x1 > text1_length) {
				// Ran off the right of the graph.
				k1end += 2;
			} else if (y1 > text2_length) {
				// Ran off the bottom of the graph.
				k1start += 2;
			} else if (front) {
				k2_offset = v_offset + delta - k1;
				if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] !== -1) {
					// Mirror x2 onto top-left coordinate system.
					x2 = text1_length - v2[k2_offset];
					if (x1 >= x2) {
						// Overlap detected.
						return diff_bisectSplit_(text1, text2, x1, y1);
					}
				}
			}
		}

		// Walk the reverse path one step.
		for (k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
			k2_offset = v_offset + k2;
			if (k2 === -d || (k2 !== d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
				x2 = v2[k2_offset + 1];
			} else {
				x2 = v2[k2_offset - 1] + 1;
			}
			y2 = x2 - k2;
			while (x2 < text1_length && y2 < text2_length &&
				   text1[text1_length - x2 - 1] ===
				   text2[text2_length - y2 - 1]) {
				x2++;
				y2++;
			}
			v2[k2_offset] = x2;
			if (x2 > text1_length) {
				// Ran off the left of the graph.
				k2end += 2;
			} else if (y2 > text2_length) {
				// Ran off the top of the graph.
				k2start += 2;
			} else if (!front) {
				k1_offset = v_offset + delta - k2;
				if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] !== -1) {
					x1 = v1[k1_offset];
					y1 = v_offset + x1 - k1_offset;
					// Mirror x2 onto top-left coordinate system.
					x2 = text1_length - x2;
					if (x1 >= x2) {
						// Overlap detected.
						return diff_bisectSplit_(text1, text2, x1, y1);
					}
				}
			}
		}
	}
	
	// Diff took too long and hit the deadline or
	// number of diffs equals number of characters, no commonality at all.
	return [DIFF_DELETE, text1, DIFF_INSERT, text2];
}


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
var
	text1a = text1.slice(0, x),
	text2a = text2.slice(0, y),
	text1b = text1.slice(x),
	text2b = text2.slice(y),
	// Compute both diffs serially.
	diffs = diff_main(text1a, text2a),
	diffsb = diff_main(text1b, text2b)
;
	return diffs.concat(diffsb);
}


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1[0] !== text2[0]) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.slice(pointerstart, pointermid) ===
        text2.slice(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
}


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
	if (!text1 || !text2 || text1[text1.length - 1] !== text2[text2.length - 1])
		return 0;
		
	// Binary search.
	// Performance analysis: http://neil.fraser.name/news/2007/10/09/
var
	pointermin = 0,
	pointermax = Math.min(text1.length, text2.length),
	pointermid = pointermax,
	pointerend = 0
;
	while (pointermin < pointermid)
	{
		if (text1.slice(text1.length - pointermid, text1.length - pointerend) ===
			text2.slice(text2.length - pointermid, text2.length - pointerend)) {
			pointermin = pointermid;
			pointerend = pointermin;
		} else {
			pointermax = pointermid;
		}
		pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
	}
	return pointermid;
}


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.slice(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) !== -1) {
      var prefixLength = diff_commonPrefix(longtext.slice(i),
                                           shorttext.slice(j));
      var suffixLength = diff_commonSuffix(longtext.slice(0, i),
                                           shorttext.slice(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.slice(j - suffixLength, j) +
            shorttext.slice(j, j + prefixLength);
        best_longtext_a = longtext.slice(0, i - suffixLength);
        best_longtext_b = longtext.slice(i + prefixLength);
        best_shorttext_a = shorttext.slice(0, j - suffixLength);
        best_shorttext_b = shorttext.slice(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
}


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 */
function diff_cleanupMerge(diffs) {
var
	pointer = 0,
	count_delete = 0,
	count_insert = 0,
	text_delete = '',
	text_insert = '',
	commonlength,
	countPointer
;
	diffs.push(DIFF_EQUAL, '');  // Add a dummy entry at the end.
	
	while (pointer < diffs.length) {
		switch (diffs[pointer]) {
			case DIFF_INSERT:
				count_insert++;
				text_insert += diffs[pointer+1];
				pointer+=2;
				break;
			case DIFF_DELETE:
				count_delete++;
				text_delete += diffs[pointer+1];
				pointer+=2;
				break;
			case DIFF_EQUAL:
				// Upon reaching an equality, check for prior redundancies.
				if (count_delete + count_insert > 1)
				{
					countPointer = (count_delete+count_insert)*2;
					
					if (count_delete !== 0 && count_insert !== 0)
					{
						// Factor out any common prefixies.
						commonlength = diff_commonPrefix(text_insert, text_delete);
						if (commonlength !== 0)
						{
							if ((pointer - countPointer) > 0 &&
								diffs[pointer - countPointer - 2] === DIFF_EQUAL) {
								diffs[pointer-countPointer-1]+=text_insert.slice(0, commonlength);
							} else {
								diffs.splice(0, 0, DIFF_EQUAL, text_insert.slice(0, commonlength));
								pointer+=2;
							}
							text_insert = text_insert.slice(commonlength);
							text_delete = text_delete.slice(commonlength);
						}
						// Factor out any common suffixies.
						commonlength = diff_commonSuffix(text_insert, text_delete);
						
						if (commonlength !== 0) {
							diffs[pointer+1] = text_insert.slice(text_insert.length -
																  commonlength) + diffs[pointer+1];
							text_insert = text_insert.slice(0, text_insert.length - commonlength);
							text_delete = text_delete.slice(0, text_delete.length - commonlength);
						}
					}
					
					// Delete the offending records and add the merged ones.
					if (count_delete === 0) {
						diffs.splice(pointer - count_insert*2,
									 countPointer, DIFF_INSERT, text_insert);
					} else if (count_insert === 0) {
						diffs.splice(pointer - count_delete*2,
									 countPointer, DIFF_DELETE, text_delete);
					} else {
						// TODO use countPointer
						diffs.splice(pointer - countPointer, countPointer, DIFF_DELETE, text_delete,
							DIFF_INSERT, text_insert);
					}
					
					pointer = pointer - (countPointer) +
						(count_delete ? 2 : 0) + (count_insert ? 2 : 0) + 2;
					
				} else if (pointer !== 0 && diffs[pointer - 2] === DIFF_EQUAL) {
					// Merge this equality with the previous one.
					diffs[pointer - 1] += diffs[pointer+1];
					diffs.splice(pointer, 2);
				} else {
					pointer+=2;
				}
				count_insert = 0;
				count_delete = 0;
				text_delete = '';
				text_insert = '';
				break;
		}
	}

	if (diffs[diffs.length - 1] === '')
	{
		// TODO Use some other method?
		diffs.pop();  // Remove the dummy entry at the end.
		diffs.pop();
	}

	// Second pass: look for single edits surrounded on both sides by equalities
	// which can be shifted sideways to eliminate an equality.
	// e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
	var changes = false;
	
	pointer = 1;
	
	// Intentionally ignore the first and last element (don't need checking).
	while (pointer < diffs.length - 2)
	{
		if (diffs[pointer - 2] === DIFF_EQUAL && diffs[pointer + 2] === DIFF_EQUAL)
		{
			// This is a single edit surrounded by equalities.
			if (diffs[pointer+1].slice(diffs[pointer+1].length -
				diffs[pointer-1].length) === diffs[pointer-1])
			{
				// Shift the edit over the previous equality.
				diffs[pointer+1] = diffs[pointer-1] +
					diffs[pointer+1].slice(0, diffs[pointer+1].length - diffs[pointer-1].length);
				
				diffs[pointer+2] = diffs[pointer-1] + diffs[pointer+2];
				diffs.splice(pointer-2, 2);
				changes = true;
			} else if (diffs[pointer+1].slice(0, diffs[pointer+3].length) === diffs[pointer+3])
			{
				// Shift the edit over the next equality.
				diffs[pointer-1] += diffs[pointer+3];
				diffs[pointer+1] = diffs[pointer+1].slice(diffs[pointer+3].length)+diffs[pointer+3];
				diffs.splice(pointer+2, 2);
				changes = true;
			}
		}
		pointer+=2;
	}
	
	// If shifts were made, the diff needs reordering and another shift sweep.
	if (changes) diff_cleanupMerge(diffs);
}
	
function push(result, ch, a, b, c)
{
	var l = result.length;
	
	if (l && (b < MINL))
	{
		result[l-3] += ch + a;
		result[l-1] += b + c;
	} else
		result.push(a, b, c);
}

function diff2(A, B)
{
var
	result=[],
	d = diff_main(A, B),
	i, l=0, ch=''
;	
	for (i=0; i<d.length; i+=2)
	{
		if (d[i]===DIFF_EQUAL)
		{
			l = d[i+1].length;
			ch = d[i+1];
		}
		else 
		{
			if (d[i]===DIFF_DELETE)
				push(result, ch, '', l, d[i+1].length);
			else
				push(result, ch, d[i+1], l, 0);
			
			l = 0;
			ch = '';
		}
	}

	return result;
}
	
ide.diff = diff2;
	
ide.diffPromise = function(A, B)
{
	return ide.diffWorker.promise('diff', [ A, B ]);
};
	
ide.patch = function(A, diff)
{
var
	i, cursor=0, result=''
;
	for (i=0; i<diff.length; i+=3)
	{
		result += A.substr(cursor, diff[i+1]) + diff[i];
		cursor += diff[i+1] + diff[i+2];
	}
	
	if (cursor < A.length)
		result += A.substr(cursor);
	
	return result;
};
	
ide.diffWorker = new ide.Worker({
	
	diff: function(data)
	{
		return diff2(data[0], data[1]);
	},
	private: {
		defs: `const DIFF_DELETE = -1,	DIFF_INSERT = 1, DIFF_EQUAL = 0, MINL=5;`,
		push: push,
		diff2: diff2,
		diff_main: diff_main,
		diff_halfMatch_: diff_halfMatch_,
		diff_bisectSplit_: diff_bisectSplit_,
		diff_bisect_: diff_bisect_,
		diff_compute_: diff_compute_,
		diff_cleanupMerge: diff_cleanupMerge,
		diff_commonPrefix: diff_commonPrefix,
		diff_commonSuffix: diff_commonSuffix
	}
	
});
	
})(this.ide);