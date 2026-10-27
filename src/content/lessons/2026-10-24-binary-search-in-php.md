---
tags: [php, dsa, binary-search, algorithms]
---
# Binary Search in PHP: 3 Templates You'll Actually Use

Binary search cuts the search space in half on every step, so it finds an answer in **O(log n)** time. It isn't only for finding a value in a sorted array. Here are the three forms that show up in real code and in interviews.

## 1. Classic search: find a value in a sorted array

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

Rules to remember: use `<=` in the loop, always move with `mid ± 1`, and use `intdiv()` so `$mid` stays an integer.

## 2. Boundary search: first or last position

With duplicates like `[1,3,3,3,5]`, a match isn't the end. Record it, then keep searching in one direction.

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

## 3. Binary search on the answer

Use this when the question asks for the **minimum or maximum value that works**, and a yes/no check `ok(x)` flips only once as `x` grows (`F F F T T T`).

Example: the smallest eating speed `k` that finishes all `piles` within `h` hours (LeetCode 875).

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

The cost is **O(n · log R)**, where R is the size of the answer range. Even with R = 10^9, that's only about 30 checks.

## Common PHP pitfalls

| Pitfall | Fix |
|---|---|
| `floor()` or `ceil()` return floats | Use `intdiv()` |
| Setting `hi` to `count()` instead of the real answer limit | Pick the range from the problem, e.g. `max($piles)` |
| Infinite loop from `lo = mid` | Always move by `mid ± 1` |
| Sorting when you don't need to | Searching on the answer doesn't need a sorted input |

## Practice
- [Binary Search (704)](https://leetcode.com/problems/binary-search/)
- [Find First and Last Position (34)](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)
- [Find Minimum in Rotated Sorted Array (153)](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/)
- [Koko Eating Bananas (875)](https://leetcode.com/problems/koko-eating-bananas/)
