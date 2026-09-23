import type { CatalogTopic } from '../types';
import { code, mcq, short, tf } from './helpers';

export const JS_TOPICS: CatalogTopic[] = [
	{
		key: 'js-fundamentals',
		title: 'JavaScript fundamentals',
		domain: 'JavaScript',
		description: 'Values, types, variables, operators, conditionals, loops and functions — the building blocks of every JavaScript program.',
		difficulty: 1,
		minutes: 240,
		skills: ['javascript', 'js'],
		concepts: ['Variables (let/const)', 'Primitive types', 'Equality (=== vs ==)', 'Control flow', 'Functions'],
		prerequisites: [],
		practice: [
			{ title: 'FizzBuzz, properly', prompt: 'Write fizzBuzz(n) returning an array of strings for 1..n instead of logging.' },
			{ title: 'Grade calculator', prompt: 'Write getGrade(score) with if/else, then with a lookup array of thresholds.' }
		],
		resources: { primary: 'javascript-info', alternative: 'mdn-js-guide', practice: 'exercism-javascript' },
		questions: [
			mcq('What does `typeof null` return?', ['"null"', '"undefined"', '"object"', '"number"'], 'c', 'Primitive types', 'A long-standing quirk.'),
			mcq('Which comparison is true?', ['0 === "0"', 'null === undefined', '1 === 1.0', '[] === []'], 'c', 'Equality (=== vs ==)', '1 and 1.0 are the same number; arrays compare by reference.'),
			tf('An object in a `const` variable can still have its properties changed.', true, 'Variables (let/const)', 'const prevents reassignment, not mutation.'),
			code(
				'Write `sum(numbers)` returning the total of an array of numbers.',
				'function sum(numbers) { return numbers.reduce((a, b) => a + b, 0); }',
				['function|=>', 'return|=>\\s*[^{]', 'reduce|for\\s*\\('],
				'Functions',
				'reduce with initial 0 handles empty arrays; a loop works too.'
			)
		]
	},
	{
		key: 'js-data-structures',
		title: 'Arrays, objects and iteration',
		domain: 'JavaScript',
		description: 'Model data with arrays and objects, transform it with map/filter/reduce, and destructure and spread values cleanly.',
		difficulty: 2,
		minutes: 180,
		skills: ['javascript'],
		concepts: ['Arrays', 'Objects', 'map/filter/reduce', 'Destructuring', 'Spread and rest'],
		prerequisites: ['js-fundamentals'],
		practice: [
			{ title: 'Shopping cart', prompt: 'Given [{name, price, qty}], compute the total and return a discounted copy without mutating the original.' },
			{ title: 'Group by', prompt: 'Write groupBy(items, key) returning an object of arrays.' }
		],
		resources: { primary: 'javascript-info', alternative: 'eloquent-javascript', practice: 'exercism-javascript' },
		questions: [
			mcq('Which method returns a new array of elements passing a test?', ['map', 'filter', 'forEach', 'find'], 'b', 'map/filter/reduce', 'filter keeps truthy results.'),
			mcq('After `const { a, ...rest } = { a: 1, b: 2, c: 3 }`, rest is…', ['{ a: 1 }', '{ b: 2, c: 3 }', '[2, 3]', 'undefined'], 'b', 'Spread and rest', 'Rest collects remaining properties.'),
			tf('`array.map` mutates the original array.', false, 'map/filter/reduce', 'map returns a new array.'),
			code('Return names of users aged 18+ from `users = [{ name, age }]` in one expression.', 'users.filter(u => u.age >= 18).map(u => u.name)', ['filter', 'map', '>=\\s*18'], 'map/filter/reduce', 'Filter, then map.')
		]
	},
	{
		key: 'js-scope-closures',
		title: 'Scope and closures',
		domain: 'JavaScript',
		description: 'How JavaScript decides which variables a function can see, and how functions remember their surrounding scope.',
		difficulty: 3,
		minutes: 120,
		skills: ['closures'],
		concepts: ['Lexical scope', 'Block vs function scope', 'Closures', 'Hoisting', 'this binding'],
		prerequisites: ['js-data-structures'],
		practice: [
			{ title: 'Counter factory', prompt: 'Write makeCounter() returning { increment, decrement, value } sharing private state.' },
			{ title: 'Fix the loop', prompt: 'Explain why `for (var i=0;i<3;i++) setTimeout(()=>console.log(i))` prints 3,3,3 and fix it two ways.' }
		],
		resources: { primary: 'javascript-info-closure', alternative: 'mdn-closures', practice: 'exercism-javascript' },
		questions: [
			mcq('What is a closure?', ['A finished function', 'A function bundled with references to its surrounding scope', 'Closing a tab', 'An IIFE'], 'b', 'Closures', 'Inner functions keep access to outer variables.'),
			code(
				'What does this log?',
				'3',
				['^\\s*3\\s*$|three'],
				'Closures',
				'inc closes over the same count: 1, 2, then 3.',
				'function outer() {\n  let count = 0;\n  return () => ++count;\n}\nconst inc = outer();\ninc(); inc();\nconsole.log(inc());'
			),
			tf('`let` variables declared in a block are accessible outside it.', false, 'Block vs function scope', 'let/const are block-scoped.'),
			short(
				'Why does `let` in a for loop fix the setTimeout closure bug?',
				'let creates a new binding each iteration, so each callback closes over its own i instead of one shared variable.',
				['each iteration|per iteration|new binding|every iteration|each loop', 'own|separate|copy'],
				'Block vs function scope',
				'var is function-scoped; let gets a fresh binding per iteration.'
			)
		]
	},
	{
		key: 'dom-events',
		title: 'The DOM and events',
		domain: 'JavaScript',
		description: 'Select and update elements, respond to events, and understand bubbling and delegation — making pages interactive.',
		difficulty: 2,
		minutes: 150,
		skills: ['dom'],
		concepts: ['Selecting elements', 'Updating the DOM', 'Event listeners', 'Bubbling and delegation', 'Forms and input events'],
		prerequisites: ['js-data-structures', 'html-semantics'],
		practice: [
			{ title: 'Todo list', prompt: 'Add, toggle and delete todos with a single delegated listener on the list.' },
			{ title: 'Character count', prompt: 'Live counter under a textarea that turns red above 280.' }
		],
		resources: { primary: 'mdn-dom-intro', alternative: 'javascript-info', practice: 'javascript30', project: 'javascript30' },
		questions: [
			mcq('What is event delegation?', ['Browser chooses handlers', 'One parent listener handling events from many children', 'One-time listeners', 'Custom events'], 'b', 'Bubbling and delegation', 'Events bubble to the parent.'),
			mcq('Safest way to insert user-provided text?', ['innerHTML', 'textContent', 'document.write', 'outerHTML'], 'b', 'Updating the DOM', 'textContent never parses HTML (prevents XSS).'),
			tf('preventDefault() on submit stops the page reloading.', true, 'Forms and input events', 'It cancels the default action.')
		]
	},
	{
		key: 'async-js',
		title: 'Asynchronous JavaScript',
		domain: 'JavaScript',
		description: 'Work with operations that finish later using promises and async/await, and understand the event loop.',
		difficulty: 3,
		minutes: 150,
		skills: ['async', 'promises'],
		concepts: ['Event loop', 'Callbacks', 'Promises', 'async/await', 'Error handling', 'fetch'],
		prerequisites: ['js-scope-closures'],
		practice: [
			{ title: 'Fetch and render', prompt: 'Fetch https://jsonplaceholder.typicode.com/users, render names, and show a friendly error offline.' },
			{ title: 'Parallel vs sequential', prompt: 'Fetch three URLs sequentially and with Promise.all; compare timings.' }
		],
		resources: { primary: 'javascript-info-async', alternative: 'mdn-promises', practice: 'mdn-fetch' },
		questions: [
			code(
				'In what order are the numbers logged?',
				'1 4 3 2',
				['1\\D*4\\D*3\\D*2'],
				'Event loop',
				'Sync first (1, 4), microtasks (3), then macrotasks (2).',
				'console.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);'
			),
			mcq('An async function always returns…', ['The raw value', 'A Promise', 'undefined', 'A callback'], 'b', 'async/await', 'Return values are wrapped in a Promise.'),
			mcq('Run independent requests concurrently and wait for all with…', ['await in a loop', 'Promise.all([...])', 'setTimeout', 'Promise.resolve()'], 'b', 'Promises', 'Promise.all starts them together.'),
			short(
				'Why doesn’t fetch() reject on 404, and how should you handle it?',
				'fetch rejects only on network failure; HTTP errors resolve, so check response.ok or status.',
				['network', 'response\\.ok|\\.ok|status'],
				'Error handling',
				'Always check response.ok.'
			)
		]
	},
	{
		key: 'js-modules-tooling',
		title: 'Modules, npm and build tools',
		domain: 'JavaScript',
		description: 'Split code into ES modules, install packages with npm, and understand what bundlers and dev servers do.',
		difficulty: 2,
		minutes: 90,
		skills: ['npm', 'vite', 'modules', 'tooling'],
		concepts: ['ES modules', 'package.json', 'Dependencies', 'Semantic versioning', 'Bundlers and dev servers'],
		prerequisites: ['js-fundamentals', 'cli-basics'],
		practice: [
			{ title: 'Split it up', prompt: 'Split a script into three modules with named exports and run it with Vite.' },
			{ title: 'Read a package.json', prompt: 'Explain every field in a real package.json, including ^ and ~.' }
		],
		resources: { primary: 'mdn-js-modules', alternative: 'vite-guide', practice: 'npm-docs' },
		questions: [
			mcq('For "^1.4.2", npm may install…', ['Only 1.4.2', '1.4.x', '1.x.x', 'Any'], 'c', 'Semantic versioning', 'Caret keeps the left-most non-zero digit.'),
			tf('devDependencies are for development and build only.', true, 'Dependencies', 'Tooling goes in devDependencies.'),
			short(
				'What problem does a bundler solve?',
				'It combines modules and dependencies into optimised browser files, handling imports, minification and code splitting.',
				['combine|bundle|merge|package', 'optimi|minif|split|fewer|smaller'],
				'Bundlers and dev servers',
				'A module graph becomes efficient assets.'
			)
		]
	},
	{
		key: 'typescript',
		title: 'TypeScript essentials',
		domain: 'JavaScript',
		description: 'Add static types: annotate functions, model data with interfaces and unions, narrow safely and use generics.',
		difficulty: 3,
		minutes: 180,
		skills: ['typescript', 'ts'],
		concepts: ['Type annotations', 'Interfaces and type aliases', 'Union types and narrowing', 'Generics', 'Strict null checks'],
		prerequisites: ['js-scope-closures', 'js-modules-tooling'],
		practice: [
			{ title: 'Type an API response', prompt: 'Type a response union {status:"ok",data} | {status:"error",message} and handle both.' },
			{ title: 'Generic helper', prompt: 'Write first<T>(items: T[]): T | undefined.' }
		],
		resources: { primary: 'ts-handbook', alternative: 'ts-playground', practice: 'exercism-typescript' },
		questions: [
			mcq('`string | number` means…', ['Both', 'Either a string or a number', 'A tuple', 'A generic'], 'b', 'Union types and narrowing', 'A union of types.'),
			tf('TypeScript types exist at runtime.', false, 'Type annotations', 'Types are erased at compile time.'),
			code('Write a type guard `isString(x: unknown)`.', 'function isString(x: unknown): x is string { return typeof x === "string"; }', ['x is string', 'typeof'], 'Union types and narrowing', '`x is string` narrows on true.')
		]
	},
	{
		key: 'components-state',
		title: 'Components and state',
		domain: 'Frontend',
		description: 'Split UI into reusable components, pass data down with props, manage state and let the UI update reactively.',
		difficulty: 3,
		minutes: 240,
		skills: ['svelte', 'react', 'vue', 'components', 'frontend framework'],
		concepts: ['Components', 'Props', 'Reactive state', 'Derived values', 'Events and callbacks', 'Lists and keys'],
		prerequisites: ['dom-events', 'js-modules-tooling'],
		practice: [
			{ title: 'Filterable list', prompt: 'Product list with search and category filter; derive the visible list from state.' },
			{ title: 'Lift state up', prompt: 'Sibling form and list sharing state through their parent.' }
		],
		resources: { primary: 'svelte-tutorial', alternative: 'react-learn', practice: 'vue-guide' },
		questions: [
			mcq('What should be stored as state?', ['Everything on screen', 'Minimal changing data; derive the rest', 'Only server data', 'Nothing'], 'b', 'Derived values', 'Minimal state avoids sync bugs.'),
			tf('Props flow down; children communicate up via callbacks or events.', true, 'Props', 'One-way data flow.'),
			short(
				'Why do list items need a stable key?',
				'Keys let the framework match items between renders to update, move or remove the right nodes and keep their state.',
				['identif|match|track', 'reorder|move|update|state|remove'],
				'Lists and keys',
				'Otherwise reordering mixes up state.'
			)
		]
	},
	{
		key: 'frontend-testing',
		title: 'Testing frontend code',
		domain: 'Frontend',
		description: 'Unit tests for logic, component tests for behaviour and end-to-end tests for critical journeys.',
		difficulty: 3,
		minutes: 150,
		skills: ['testing', 'vitest', 'jest', 'playwright'],
		concepts: ['Unit tests', 'Component tests', 'End-to-end tests', 'Arrange-act-assert', 'Testing behaviour not implementation'],
		prerequisites: ['components-state'],
		practice: [
			{ title: 'Test a pure function', prompt: 'Test formatPrice(cents, currency) including 0, negatives and rounding.' },
			{ title: 'E2E a journey', prompt: 'Playwright: sign up, create an item, verify it appears.' }
		],
		resources: { primary: 'vitest-guide', alternative: 'testing-library', practice: 'playwright-intro' },
		questions: [
			mcq('Most confidence that a full journey works?', ['Unit', 'Snapshot', 'End-to-end', 'Type check'], 'c', 'End-to-end tests', 'E2E runs the real app.'),
			tf('Good UI tests query by role and label, not CSS classes.', true, 'Testing behaviour not implementation', 'They survive refactors.'),
			short(
				'Describe arrange–act–assert.',
				'Set up inputs (arrange), perform the behaviour (act), check the outcome (assert).',
				['set ?up|prepare|arrange', 'perform|call|run|act|execute', 'check|verify|expect|assert'],
				'Arrange-act-assert',
				'Consistent structure keeps tests readable.'
			)
		]
	},
	{
		key: 'web-performance',
		title: 'Web performance',
		domain: 'Frontend',
		description: 'Measure and improve speed with Core Web Vitals, code splitting, caching and image optimisation.',
		difficulty: 3,
		minutes: 120,
		skills: ['performance', 'web vitals'],
		concepts: ['Core Web Vitals', 'Critical rendering path', 'Code splitting', 'Caching', 'Image optimisation'],
		prerequisites: ['components-state'],
		practice: [{ title: 'Lighthouse audit', prompt: 'Fix the top two Lighthouse opportunities on a project; record before/after.' }],
		resources: { primary: 'webdev-performance', alternative: 'webdev-vitals' },
		questions: [
			mcq('Which metric measures visual stability?', ['LCP', 'INP', 'CLS', 'TTFB'], 'c', 'Core Web Vitals', 'Cumulative Layout Shift.'),
			tf('Lazy-loading below-the-fold images can speed up initial load.', true, 'Image optimisation', 'Frees bandwidth for critical assets.'),
			short(
				'What is code splitting and why does it help?',
				'Breaking the bundle into chunks loaded on demand so users download only what the page needs.',
				['chunk|split|separate', 'demand|lazy|only|needed|less'],
				'Code splitting',
				'Less JavaScript up front.'
			)
		]
	}
];
