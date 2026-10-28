---
title: "Binary Search in PHP: 3 Templates You’ll Actually Use"
date: 2026-10-27
description: "Learn binary search in PHP with 3 ready templates: classic search, first/last position, and binary search on the answer, plus common PHP pitfalls."
summary: "Learn binary search in PHP with 3 ready templates: classic search, first/last position, and binary search on the answer, plus common PHP pitfalls."
tags: ["php", "dsa", "binary-search", "algorithms"]
canonical: https://medium.com/@raghavji2050/binary-search-in-php-3-templates-youll-actually-use-f47418734b5d
---

*This article was drafted with AI assistance and reviewed for accuracy.*

Quick answer: Binary search in PHP halves the search space on every step, so it runs in O(log n) time. You only need three templates: classic search for a value in a sorted array, boundary search for the first or last position, and binary search on the answer for “minimum or maximum value that works” problems. In every one, use intdiv() so $mid stays an integer.

Binary search isn’t only for finding a value in a sorted array. Below are the three forms that show up in real code and in interviews, each with PHP code you can copy.

## How do you write binary search in PHP?

The classic version finds a value in a sorted array and returns its index, or -1 if the value isn’t there.

```php
function search(array $a, int $target): int {
    $lo = 0; $hi = count($a) - 1;
    while ($lo <= $hi) {
        $mid = $lo + intdiv($hi - $lo, 2); // integer mid, no float
        if ($a[$mid] === $target) return $mid;
        if ($a[$mid] < $target) $lo = $mid + 1;
        else $hi = $mid - 1;
    }
    return -1;
}
```

Three rules to remember:

* Use ≤ in the loop condition.
* Always move with mid ± 1.
* Use intdiv() so $mid stays an integer.

## How do you find the first or last position with binary search?

With duplicates like [1,3,3,3,5], finding a match isn’t the end. Record the match, then keep searching in one direction: left for the first position, right for the last.

```php
function bound(array $a, int $target, bool $first): int {
    $lo = 0; $hi = count($a) - 1; $ans = -1;
    while ($lo <= $hi) {
        $mid = $lo + intdiv($hi - $lo, 2);
        if ($a[$mid] === $target) {
            $ans = $mid;
            if ($first) $hi = $mid - 1; else $lo = $mid + 1;
        } elseif ($a[$mid] < $target) $lo = $mid + 1;
        else $hi = $mid - 1;
    }
    return $ans;
}
// bound([1,3,3,3,5], 3, true)  => 1
// bound([1,3,3,3,5], 3, false) => 3
```

## What is “binary search on the answer”?

Use this template when the question asks for the minimum or maximum value that works, and a yes/no check ok(x) flips only once as x grows (F F F T T T). You aren’t searching an array. You’re searching the range of possible answers.

### Binary search template example: Koko Eating Bananas (LeetCode 875)

The task is to find the smallest eating speed k that finishes all piles within h hours.

```php
function minSpeed(array $piles, int $h): int {
    $lo = 1; $hi = max($piles); $ans = $hi;
    while ($lo <= $hi) {
        $mid = $lo + intdiv($hi - $lo, 2);
        $hours = 0;
        foreach ($piles as $p) $hours += intdiv($p + $mid - 1, $mid); // ceil
        if ($hours <= $h) { $ans = $mid; $hi = $mid - 1; } // works: try smaller
        else $lo = $mid + 1;
    }
    return $ans;
}
```

The cost is O(n · log R), where R is the size of the answer range. Even with R = 10⁹, that’s only about 30 checks.

## Common binary search mistakes in PHP

* floor() or ceil() return floats → Use intdiv()
* Setting hi to count() instead of the real answer limit → Pick the range from the problem, e.g. max($piles)
* Infinite loop from lo = mid → Always move by mid ± 1
* Sorting when you don’t need to → Searching on the answer doesn’t need a sorted input

## Binary search practice problems

Binary Search (704): <https://leetcode.com/problems/binary-search/>

Find First and Last Position (34): <https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/>

Find Minimum in Rotated Sorted Array (153): <https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/>

Koko Eating Bananas (875): <https://leetcode.com/problems/koko-eating-bananas/>

*Writing a lot of prompts while you practise or build? PromptPilot helps you shape them:* [*PromptPilot*](https://promptpilot-ai-psi.vercel.app)

## FAQ

### What is the time complexity of binary search in PHP?

Classic binary search runs in O(log n) because each step halves the search space. Binary search on the answer costs O(n · log R), where R is the size of the answer range.

### Why use intdiv() instead of floor() in PHP binary search?

floor() and ceil() return floats. intdiv() returns an integer, so $mid stays a valid array index.

### How do I find the first and last occurrence of a value in a sorted PHP array?

Use the boundary template. When you find a match, save it, then move hi to mid — 1 for the first position or lo to mid + 1 for the last. For [1,3,3,3,5] and target 3, that gives 1 and 3.

### Does binary search always need a sorted array?

Classic and boundary search do. Binary search on the answer doesn’t need a sorted input. It needs a yes/no check that flips only once as the value grows.

### Why does my binary search loop forever?

Usually because of lo = mid. Always move by mid ± 1 so the range shrinks on every step.
