// Every prompt, choice, and answer is taken from a published lesson on this site.
const password = '2026-11-03-password-hashing-in-php-password-hash-verify-rehash';
const mass = '2026-11-04-laravel-mass-assignment-fillable-guarded-validated';
const csrf = '2026-11-05-laravel-csrf-protection-tokens-exceptions-spa';
const xss = '2026-11-06-xss-prevention-laravel-blade-echo-js-from';
const sql = '2026-11-07-sql-injection-laravel-raw-queries-bindings-order-by';

export const QUIZZES = {
  [password]: [
    {
      id: 'pw-hash',
      prompt: 'Which call does the password hashing lesson say to use for a new password?',
      choices: ['md5($password)', "hash('sha256', $password)", 'password_hash($password, PASSWORD_DEFAULT)', 'sha1($password)'],
      answer: 2,
      source: 'The lesson’s quick answer says to hash passwords with password_hash($password, PASSWORD_DEFAULT), and not md5(), sha1(), or plain hash(\'sha256\', ...).',
    },
    {
      id: 'pw-rehash',
      prompt: 'When does that lesson say password_needs_rehash() returns true?',
      choices: [
        'When the password is shorter than 8 characters',
        'When the stored hash does not match the algorithm and options you pass in',
        'When the user is an administrator',
        'Whenever password_hash() was used',
      ],
      answer: 1,
      source: 'The lesson says password_needs_rehash() returns true when the stored hash does not match the algorithm and options you pass in.',
    },
    {
      id: 'pw-cost',
      prompt: 'What does the lesson say changed for the default bcrypt cost in PHP 8.4.0?',
      choices: ['It was removed', 'It went from 12 to 4', 'It went from 10 to 12', 'It stayed at 8'],
      answer: 2,
      source: 'The lesson says the PHP manual’s changelog notes that in PHP 8.4.0 the default bcrypt cost went from 10 to 12.',
    },
  ],
  [mass]: [
    {
      id: 'ma-all',
      prompt: 'The mass assignment lesson says never to pass which value straight into create(), update(), or fill()?',
      choices: ['$request->validated()', '$request->safe()->only([...])', '$request->all()', 'an explicit list of allowed fields'],
      answer: 2,
      source: 'The lesson’s quick answer says never pass $request->all() straight into create(), update(), or fill().',
    },
    {
      id: 'ma-guarded',
      prompt: 'What does the lesson say $guarded = [] does?',
      choices: ['It blocks every column', 'It makes every column mass assignable', 'It turns on CSRF checks', 'It encrypts the model'],
      answer: 1,
      source: 'The lesson says $guarded = [] makes every column mass assignable.',
    },
    {
      id: 'ma-admin',
      prompt: 'Which unexpected request field does the lesson use as the classic mass-assignment example?',
      choices: ['csrf_token', 'is_admin', '_method', 'remember'],
      answer: 1,
      source: 'The lesson says the classic example is a malicious is_admin parameter that reaches User::create().',
    },
  ],
  [csrf]: [
    {
      id: 'csrf-blade',
      prompt: 'Which Blade directive does the CSRF lesson say adds the hidden token field?',
      choices: ['@js', '@csrf', '@verbatim', '@method'],
      answer: 1,
      source: 'The lesson says to put a CSRF secret in forms with @csrf / _token.',
    },
    {
      id: 'csrf-status',
      prompt: 'Which HTTP status does the lesson say a CSRF token mismatch typically yields?',
      choices: ['200', '301', '419', '503'],
      answer: 2,
      source: 'The lesson says a mismatch typically yields HTTP 419.',
    },
    {
      id: 'csrf-spa',
      prompt: 'For a first-party Sanctum SPA, which URL does the lesson say to call first?',
      choices: ['/sanctum/login', '/sanctum/csrf-cookie', '/api/user', '/csrf/disable'],
      answer: 1,
      source: 'The lesson’s quick answer says to call /sanctum/csrf-cookie first for a first-party SPA with Sanctum.',
    },
  ],
  [xss]: [
    {
      id: 'xss-escape',
      prompt: 'The XSS lesson says Blade {{ }} passes the value through which PHP function?',
      choices: ['strip_tags', 'eval', 'htmlspecialchars', 'base64_encode'],
      answer: 2,
      source: 'The lesson says Blade {{ $value }} and Laravel’s e() helper pass the string through PHP’s htmlspecialchars.',
    },
    {
      id: 'xss-raw',
      prompt: 'The lesson says {!! !!} is for which kind of content?',
      choices: ['Any comment a user typed', 'Content you already trust or have sanitized', 'Every query-string value', 'Stored passwords'],
      answer: 1,
      source: 'The lesson says to reserve {!! $html !!} for content you already trust or have sanitized.',
    },
    {
      id: 'xss-json',
      prompt: 'The lesson says to embed an array or object inside a script tag with which API?',
      choices: ['raw json_encode', 'Js::from / Illuminate\\Support\\Js::from', 'an unescaped echo', '{!! json_encode($data) !!} as the default'],
      answer: 1,
      source: 'The lesson says to use Js::from / Illuminate\\Support\\Js::from instead of raw json_encode inside a script block.',
    },
  ],
  [sql]: [
    {
      id: 'sql-safe',
      prompt: 'Which call does the SQL injection lesson treat as safe because the query builder binds the value?',
      choices: ['DB::select("... \'$input\'")', "where('email', $request->email)", 'whereRaw("... $input")', 'orderByRaw($request->sort)'],
      answer: 1,
      source: 'The lesson’s quick answer says where(\'email\', $request->email) is safe because Laravel binds values through PDO.',
    },
    {
      id: 'sql-columns',
      prompt: 'The lesson quotes Laravel’s warning that PDO does not support binding which of these?',
      choices: ['String values', 'Integers', 'Column names', 'Null'],
      answer: 2,
      source: 'The lesson says the query builder docs warn that PDO does not support binding column names.',
    },
    {
      id: 'sql-order',
      prompt: 'Where does the lesson say column names and sort directions should come from?',
      choices: ['The request sort parameter, used directly', 'A fixed allow-list in your code', 'A comment in the SQL string', 'md5() of the column name'],
      answer: 1,
      source: 'The lesson says to pass values as bindings and pick columns and sort directions from a fixed allow-list in your code.',
    },
  ],
};

export function quizFor(slug) {
  const questions = QUIZZES[slug];
  if (!questions) return null;
  return { slug, url: `/lessons/${slug}`, questions };
}

export function masterclassQuiz() {
  return Object.entries(QUIZZES).map(([slug, questions]) => ({
    slug,
    url: `/lessons/${slug}`,
    ...questions[0],
  }));
}
