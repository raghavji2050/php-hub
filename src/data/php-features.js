// Curated syntax and function signals documented in the PHP manual.
// This is not a complete compatibility matrix. Versions here are ones we can
// tie to a public php.net page. Unknown constructs are omitted on purpose.
export const PHP_VERSIONS = ['8.0', '8.1', '8.2', '8.3', '8.4', '8.5'];

export const PHP_FEATURES = [
  { id: 'str_contains', version: '8.0', name: 'str_contains()', pattern: String.raw`\bstr_contains\s*\(`, url: 'https://www.php.net/manual/en/function.str-contains.php' },
  { id: 'str_starts_with', version: '8.0', name: 'str_starts_with()', pattern: String.raw`\bstr_starts_with\s*\(`, url: 'https://www.php.net/manual/en/function.str-starts-with.php' },
  { id: 'str_ends_with', version: '8.0', name: 'str_ends_with()', pattern: String.raw`\bstr_ends_with\s*\(`, url: 'https://www.php.net/manual/en/function.str-ends-with.php' },
  { id: 'nullsafe', version: '8.0', name: 'nullsafe operator (?->)', pattern: String.raw`\?->`, url: 'https://www.php.net/manual/en/migration80.new-features.php' },
  { id: 'match', version: '8.0', name: 'match expression', pattern: String.raw`\bmatch\s*\(`, url: 'https://www.php.net/manual/en/control-structures.match.php' },
  { id: 'attribute', version: '8.0', name: 'attribute (#[...])', pattern: String.raw`#\[`, url: 'https://www.php.net/manual/en/language.attributes.overview.php' },
  { id: 'ctor_promo', version: '8.0', name: 'constructor property promotion', pattern: String.raw`\bfunction\s+__construct\s*\([\s\S]{0,400}?\b(?:public|protected|private)\b`, url: 'https://www.php.net/manual/en/language.oop5.decon.php' },
  { id: 'weakmap', version: '8.0', name: 'WeakMap', pattern: String.raw`\bWeakMap\b`, url: 'https://www.php.net/manual/en/class.weakmap.php' },
  { id: 'enum', version: '8.1', name: 'enum', pattern: String.raw`\benum\s+[A-Za-z_\\]`, url: 'https://www.php.net/manual/en/language.enumerations.php' },
  { id: 'readonly_class', version: '8.2', name: 'readonly class', pattern: String.raw`\breadonly\s+class\b`, url: 'https://www.php.net/manual/en/language.oop5.basic.php' },
  { id: 'readonly_prop', version: '8.1', name: 'readonly property', pattern: String.raw`\breadonly\s+(?!class\b)`, url: 'https://www.php.net/manual/en/language.oop5.properties.php' },
  { id: 'never', version: '8.1', name: 'never return type', pattern: String.raw`:\s*never\b`, url: 'https://www.php.net/manual/en/language.types.never.php' },
  { id: 'array_is_list', version: '8.1', name: 'array_is_list()', pattern: String.raw`\barray_is_list\s*\(`, url: 'https://www.php.net/manual/en/function.array-is-list.php' },
  { id: 'octal', version: '8.1', name: 'explicit octal (0o)', pattern: String.raw`\b0o[0-7]+\b`, url: 'https://www.php.net/manual/en/migration81.new-features.php' },
  { id: 'fiber', version: '8.1', name: 'Fiber', pattern: String.raw`\bFiber::|\bnew\s+Fiber\b`, url: 'https://www.php.net/manual/en/class.fiber.php' },
  { id: 'sensitive', version: '8.2', name: 'SensitiveParameter attribute', pattern: String.raw`#\[\s*\\?SensitiveParameter\b`, url: 'https://www.php.net/manual/en/class.sensitiveparameter.php' },
  { id: 'typed_const', version: '8.3', name: 'typed class constant', pattern: String.raw`\bconst\s+(?:public\s+|protected\s+|private\s+)?(?:string|int|float|bool|array|iterable|mixed|object|null|true|false|never)\s+[A-Za-z_]`, url: 'https://www.php.net/manual/en/language.oop5.constants.php' },
  { id: 'json_validate', version: '8.3', name: 'json_validate()', pattern: String.raw`\bjson_validate\s*\(`, url: 'https://www.php.net/manual/en/function.json-validate.php' },
  { id: 'override', version: '8.3', name: 'Override attribute', pattern: String.raw`#\[\s*\\?Override\b`, url: 'https://www.php.net/manual/en/class.override.php' },
  { id: 'mb_str_pad', version: '8.3', name: 'mb_str_pad()', pattern: String.raw`\bmb_str_pad\s*\(`, url: 'https://www.php.net/manual/en/function.mb-str-pad.php' },
  { id: 'array_find', version: '8.4', name: 'array_find()', pattern: String.raw`\barray_find\s*\(`, url: 'https://www.php.net/manual/en/function.array-find.php' },
  { id: 'array_any', version: '8.4', name: 'array_any()', pattern: String.raw`\barray_any\s*\(`, url: 'https://www.php.net/manual/en/function.array-any.php' },
  { id: 'array_all', version: '8.4', name: 'array_all()', pattern: String.raw`\barray_all\s*\(`, url: 'https://www.php.net/manual/en/function.array-all.php' },
  { id: 'array_find_key', version: '8.4', name: 'array_find_key()', pattern: String.raw`\barray_find_key\s*\(`, url: 'https://www.php.net/manual/en/function.array-find-key.php' },
  { id: 'mb_trim', version: '8.4', name: 'mb_trim()', pattern: String.raw`\bmb_trim\s*\(`, url: 'https://www.php.net/manual/en/function.mb-trim.php' },
  { id: 'mb_ltrim', version: '8.4', name: 'mb_ltrim()', pattern: String.raw`\bmb_ltrim\s*\(`, url: 'https://www.php.net/manual/en/function.mb-ltrim.php' },
  { id: 'mb_rtrim', version: '8.4', name: 'mb_rtrim()', pattern: String.raw`\bmb_rtrim\s*\(`, url: 'https://www.php.net/manual/en/function.mb-rtrim.php' },
  { id: 'request_parse_body', version: '8.4', name: 'request_parse_body()', pattern: String.raw`\brequest_parse_body\s*\(`, url: 'https://www.php.net/manual/en/function.request-parse-body.php' },
  { id: 'asymmetric', version: '8.4', name: 'asymmetric visibility', pattern: String.raw`\b(?:public|protected|private)\s*\(\s*set\s*\)`, url: 'https://www.php.net/manual/en/migration84.new-features.php' },
  { id: 'new_deref', version: '8.4', name: 'new Foo()->method without extra parentheses', pattern: String.raw`\bnew\s+[A-Za-z_\\][\w\\]*\s*\([^)\n]*\)\s*->`, url: 'https://www.php.net/manual/en/migration84.new-features.php' },
  { id: 'pipe', version: '8.5', name: 'pipe operator (|>)', pattern: String.raw`\|>`, url: 'https://www.php.net/manual/en/migration85.new-features.php' },
  { id: 'array_first', version: '8.5', name: 'array_first()', pattern: String.raw`\barray_first\s*\(`, url: 'https://www.php.net/manual/en/function.array-first.php' },
  { id: 'array_last', version: '8.5', name: 'array_last()', pattern: String.raw`\barray_last\s*\(`, url: 'https://www.php.net/manual/en/function.array-last.php' },
];

export const PHP_REMOVED = [
  { id: 'each', version: '8.0', name: 'each()', pattern: String.raw`\beach\s*\(`, url: 'https://www.php.net/manual/en/function.each.php', note: 'Removed in PHP 8.0.' },
  { id: 'create_function', version: '8.0', name: 'create_function()', pattern: String.raw`\bcreate_function\s*\(`, url: 'https://www.php.net/manual/en/function.create-function.php', note: 'Removed in PHP 8.0.' },
  { id: 'money_format', version: '8.0', name: 'money_format()', pattern: String.raw`\bmoney_format\s*\(`, url: 'https://www.php.net/manual/en/function.money-format.php', note: 'Removed in PHP 8.0.' },
];

export const PHP_MANUAL = [
  ['PHP 8.0 migration', 'https://www.php.net/manual/en/migration80.php'],
  ['PHP 8.1 migration', 'https://www.php.net/manual/en/migration81.php'],
  ['PHP 8.2 migration', 'https://www.php.net/manual/en/migration82.php'],
  ['PHP 8.3 migration', 'https://www.php.net/manual/en/migration83.php'],
  ['PHP 8.4 migration', 'https://www.php.net/manual/en/migration84.php'],
  ['PHP 8.5 migration', 'https://www.php.net/manual/en/migration85.php'],
];
