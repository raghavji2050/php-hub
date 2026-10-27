---
tags: [php, dsa, stack, algorithms]
---
# Stacks in PHP: Brackets, RPN, and the Monotonic Stack

A stack is last in, first out (LIFO). In PHP you don't need a class for one, because a plain array already works as a stack. This lesson covers the basic stack template and the monotonic stack, which answers "next greater" questions in **O(n)**.

## 1. PHP arrays as stacks

```php
$st = [];
$st[] = 5;            // push
$top = end($st);      // peek (false if empty)
$x = array_pop($st);  // pop, O(1)
empty($st);           // is it empty?
```

Avoid `array_shift()`. It takes from the front and reindexes the whole array, so each call is O(n).

## 2. Template: valid brackets

```php
function isValid(string $s): bool {
    $pair = [')' => '(', ']' => '[', '}' => '{'];
    $st = [];
    foreach (str_split($s) as $c) {
        if (!isset($pair[$c])) { $st[] = $c; continue; } // opener
        if (empty($st) || array_pop($st) !== $pair[$c]) return false;
    }
    return empty($st); // leftover openers mean invalid
}
```

## 3. Evaluate Reverse Polish Notation

Push the numbers. When you see an operator, pop **b first** (the right operand), then a, and push `a op b`.

```php
function evalRPN(array $tokens): int {
    $st = [];
    foreach ($tokens as $t) {
        if (!in_array($t, ['+', '-', '*', '/'], true)) { $st[] = (int)$t; continue; }
        $b = array_pop($st); $a = array_pop($st);
        $st[] = match ($t) {
            '+' => $a + $b,
            '-' => $a - $b,
            '*' => $a * $b,
            '/' => intdiv($a, $b), // truncates toward zero and returns an int
        };
    }
    return $st[0];
}
```

`floor(-7/2)` gives `-4.0`, a float rounded toward −∞. `intdiv(-7, 2)` gives `-3`, which is what the problem expects.

## 4. Monotonic stack: next greater element

Keep **indices** on the stack, ordered so their values decrease. When a bigger value arrives, every smaller one it pops has found its next greater element.

```php
function nextGreater(array $a): array {
    $n = count($a);
    $ans = array_fill(0, $n, -1);
    $st = []; // indices
    for ($i = 0; $i < $n; $i++) {
        while (!empty($st) && $a[end($st)] < $a[$i]) { // compare VALUES
            $j = array_pop($st);
            $ans[$j] = $a[$i];   // or $i - $j for a "how many steps" answer
        }
        $st[] = $i;
    }
    return $ans;
}
// nextGreater([2,1,5,3,6,4]) => [5,5,6,6,-1,-1]
```

The most common bug is `end($st) < $a[$i]`, which compares an **index** with a **value**. Write `$a[end($st)]`.

## 5. Variants

| Need | Change |
|---|---|
| Next smaller | Pop while `$a[end($st)] > $a[$i]` |
| Previous greater or smaller | After the `while` finishes, the remaining top (if any) is the answer for `$i` |
| Gap in steps (739) | `$ans[$j] = $i - $j`, with a default of `0` |
| Circular array (503) | Loop `$i < 2 * $n` and use `$k = $i % $n`. Push only when `$i < $n` |

## 6. Why it's O(n)

The loops look nested, but each index is pushed exactly once and popped at most once. That adds up to at most 2n stack operations over the whole run, so the cost is **O(n) amortized** time and O(n) space.

## Common PHP pitfalls

| Pitfall | Fix |
|---|---|
| Using `array_shift()` to pop | Use `array_pop()` |
| Pushing values, then needing the position | Push indices and read the value through `$a[$j]` |
| `end($st) < $a[$i]` | `$a[end($st)] < $a[$i]` |
| `if` instead of `while` | One new element can pop many |
| Popping RPN operands as a then b | Pop b first, then a |
| `floor()` for division | `intdiv()` |
| Leaving numeric strings on the stack | Cast with `(int)` |

## Practice
- [Valid Parentheses (20)](https://leetcode.com/problems/valid-parentheses/)
- [Evaluate Reverse Polish Notation (150)](https://leetcode.com/problems/evaluate-reverse-polish-notation/)
- [Daily Temperatures (739)](https://leetcode.com/problems/daily-temperatures/)
- [Next Greater Element II (503)](https://leetcode.com/problems/next-greater-element-ii/)
