import type { CatalogTopic } from '../types';
import { code, mcq, short, tf } from './helpers';

export const BACKEND_TOPICS: CatalogTopic[] = [
	{
		key: 'node-basics',
		title: 'Server-side JavaScript with Node',
		domain: 'Backend',
		description:
			'Run JavaScript on the server: the event loop, modules, the file system, environment variables and a minimal HTTP server.',
		difficulty: 2,
		minutes: 150,
		skills: ['node', 'nodejs', 'bun', 'backend'],
		concepts: ['Runtime vs browser', 'Non-blocking I/O', 'File system', 'Environment variables', 'HTTP server'],
		prerequisites: ['async-js', 'js-modules-tooling'],
		practice: [
			{ title: 'Tiny server', prompt: 'GET / returns HTML and GET /api/time returns JSON with the current time.' },
			{ title: 'Config from env', prompt: 'Read PORT and GREETING from env with defaults; fail fast on invalid values.' }
		],
		resources: { primary: 'node-learn', alternative: 'full-stack-open', practice: 'express-guide' },
		questions: [
			mcq(
				'Why is blocking the event loop harmful?',
				['More memory', 'No other requests are handled until it finishes', 'Crashes the process', 'Disables async'],
				'b',
				'Non-blocking I/O',
				'JS runs on one thread.'
			),
			tf(
				'Secrets should come from environment variables, not source code.',
				true,
				'Environment variables',
				'Keeps secrets out of the repo.'
			),
			mcq(
				'Which global does NOT exist in Node by default?',
				['process', 'console', 'window', 'setTimeout'],
				'c',
				'Runtime vs browser',
				'window is browser-only.'
			)
		]
	},
	{
		key: 'rest-apis',
		title: 'Designing REST APIs',
		domain: 'Backend',
		description: 'Design predictable HTTP APIs: resources, methods, status codes, validation, pagination and consistent errors.',
		difficulty: 3,
		minutes: 180,
		skills: ['api', 'rest', 'express'],
		concepts: ['Resources and routes', 'HTTP methods', 'Status codes', 'Input validation', 'Middleware', 'Error responses'],
		prerequisites: ['node-basics', 'how-the-web-works'],
		practice: [
			{ title: 'CRUD API', prompt: 'Notes API with GET/POST/PATCH/DELETE returning 201, 400 and 404 correctly.' },
			{ title: 'Error format', prompt: 'Design one JSON error format and apply it everywhere.' }
		],
		resources: { primary: 'express-guide', alternative: 'mdn-http-methods', practice: 'full-stack-open' },
		questions: [
			mcq('Status for a POST that created a resource?', ['200', '201', '204', '302'], 'b', 'Status codes', '201 Created.'),
			mcq(
				'Which method is idempotent?',
				['POST', 'PUT', 'PATCH (always)', 'None'],
				'b',
				'HTTP methods',
				'Repeating PUT gives the same state.'
			),
			tf('Client-side validation alone protects an API.', false, 'Input validation', 'Always validate on the server.'),
			short(
				'What is middleware?',
				'Functions that run in sequence during request handling and can inspect or modify request/response — auth, logging, parsing.',
				['request', 'sequence|chain|before|pipeline|order', 'auth|log|pars'],
				'Middleware',
				'Composes cross-cutting concerns.'
			)
		]
	},
	{
		key: 'sql-fundamentals',
		title: 'SQL fundamentals',
		domain: 'Databases',
		description:
			'Query relational data with SELECT, filter and sort, join tables, aggregate with GROUP BY and modify rows safely.',
		difficulty: 2,
		minutes: 180,
		skills: ['sql', 'postgres', 'mysql', 'database'],
		concepts: ['SELECT and WHERE', 'JOINs', 'GROUP BY and aggregates', 'INSERT/UPDATE/DELETE', 'NULL handling'],
		prerequisites: [],
		practice: [
			{ title: 'SQLBolt 1–12', prompt: 'Complete SQLBolt lessons 1–12; note the concept that surprised you.' },
			{ title: 'Answer with SQL', prompt: 'Top 5 customers by spend, customers with no orders, monthly revenue.' }
		],
		resources: { primary: 'sqlbolt', alternative: 'postgres-tutorial', practice: 'pg-exercises' },
		questions: [
			mcq(
				'Which JOIN keeps all left rows even without a match?',
				['INNER', 'LEFT', 'CROSS', 'SELF'],
				'b',
				'JOINs',
				'Unmatched rows get NULLs.'
			),
			mcq(
				'Which clause filters groups after aggregation?',
				['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
				'b',
				'GROUP BY and aggregates',
				'HAVING filters groups.'
			),
			tf('`WHERE email = NULL` finds rows without email.', false, 'NULL handling', 'Use IS NULL.'),
			code(
				'Return each customer_id and order count from `orders`, most first.',
				'SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id ORDER BY orders DESC;',
				['select', 'count\\s*\\(', 'group by\\s+customer_id', 'order by'],
				'GROUP BY and aggregates',
				'Group, count, order.'
			)
		]
	},
	{
		key: 'data-modeling',
		title: 'Relational data modeling',
		domain: 'Databases',
		description: 'Design correct schemas: keys, relationships, normalisation, constraints, indexes and transactions.',
		difficulty: 3,
		minutes: 150,
		skills: ['database design'],
		concepts: ['Primary and foreign keys', 'Relationships', 'Normalisation', 'Constraints', 'Indexes', 'Transactions'],
		prerequisites: ['sql-fundamentals'],
		practice: [
			{
				title: 'Model a library',
				prompt: 'Books, authors (many-to-many), members and loans with keys, constraints and an index.'
			},
			{ title: 'Explain a query', prompt: 'EXPLAIN ANALYZE a slow query, add an index, compare.' }
		],
		resources: { primary: 'postgres-tutorial', alternative: 'drizzle-docs', practice: 'pg-exercises' },
		questions: [
			mcq(
				'Many-to-many is modeled with…',
				['A CSV column', 'A join table with two foreign keys', 'Duplicate rows', 'JSON'],
				'b',
				'Relationships',
				'A junction table.'
			),
			tf('Indexes speed reads but cost writes.', true, 'Indexes', 'Each write maintains the index.'),
			short(
				'Why wrap related writes in a transaction?',
				'So they succeed or fail together, keeping data consistent if something fails midway.',
				['all or nothing|together|atomic|both', 'consisten|partial|fail|half'],
				'Transactions',
				'Atomicity prevents half-applied changes.'
			)
		]
	},
	{
		key: 'auth-security',
		title: 'Authentication and web security',
		domain: 'Backend',
		description:
			'Authenticate with hashed passwords and secure sessions, authorise every request, and defend against the OWASP Top Ten.',
		difficulty: 4,
		minutes: 180,
		skills: ['security', 'auth', 'authentication'],
		concepts: ['Password hashing', 'Sessions and cookies', 'Authorization checks', 'XSS', 'CSRF', 'SQL injection'],
		prerequisites: ['rest-apis', 'data-modeling'],
		practice: [
			{ title: 'Threat model', prompt: 'List every endpoint, who may call it, and how the server verifies that.' },
			{ title: 'Break it, fix it', prompt: 'Demonstrate SQL injection locally, then fix it with parameters.' }
		],
		resources: { primary: 'owasp-top-ten', alternative: 'owasp-auth-cheatsheet', practice: 'owasp-session-cheatsheet' },
		questions: [
			mcq(
				'How should passwords be stored?',
				['AES encrypted', 'Slow salted hash (bcrypt/scrypt/argon2)', 'Base64', 'Plain text'],
				'b',
				'Password hashing',
				'Hashes resist brute force.'
			),
			mcq(
				'Changing /notes/42 to /43 shows another user’s note. What failed?',
				['Authentication', 'Authorization', 'Encryption', 'Rate limiting'],
				'b',
				'Authorization checks',
				'Check ownership (IDOR).'
			),
			tf('HttpOnly cookies cannot be read by JavaScript.', true, 'Sessions and cookies', 'Limits XSS damage.'),
			short(
				'How do parameterised queries prevent SQL injection?',
				'Input is sent separately as data and never parsed as SQL, so it cannot change the query structure.',
				['data|value|separate|parameter', 'never|not.*(sql|code|execut|pars)|structure'],
				'SQL injection',
				'The plan is fixed before values bind.'
			)
		]
	},
	{
		key: 'deployment-devops',
		title: 'Deployment and DevOps basics',
		domain: 'DevOps',
		description: 'Ship to production: environment config, build/start commands, managed databases, CI, containers and logs.',
		difficulty: 3,
		minutes: 150,
		skills: ['deployment', 'devops', 'docker', 'ci'],
		concepts: ['Environments and config', 'Build vs runtime', 'Containers', 'CI pipelines', 'Logs and monitoring'],
		prerequisites: ['node-basics', 'git-basics'],
		practice: [
			{ title: 'Ship it', prompt: 'Deploy an app with a database; secrets as environment variables.' },
			{ title: 'CI', prompt: 'GitHub Actions: install, lint, test, build on push.' }
		],
		resources: { primary: 'twelve-factor', alternative: 'docker-get-started', practice: 'github-actions' },
		questions: [
			mcq(
				'Per Twelve-Factor, deploy-specific config lives in…',
				['Code', 'Environment variables', 'Committed JSON', 'The DB'],
				'b',
				'Environments and config',
				'Separate config from code.'
			),
			tf('A container image bundles an app with its dependencies.', true, 'Containers', 'Reproducible anywhere.'),
			short(
				'What should CI check before merge?',
				'Install, lint and type checks, tests and a successful build.',
				['test', 'lint|type', 'build'],
				'CI pipelines',
				'Catch regressions automatically.'
			)
		]
	},
	{
		key: 'system-design-basics',
		title: 'System design fundamentals',
		domain: 'Architecture',
		description: 'Reason about scale and reliability: caching, load balancing, database scaling, queues and trade-offs.',
		difficulty: 4,
		minutes: 180,
		skills: ['system design', 'architecture'],
		concepts: ['Scalability', 'Caching', 'Load balancing', 'Database scaling', 'Queues and async work', 'Trade-offs'],
		prerequisites: ['data-modeling', 'deployment-devops'],
		practice: [
			{ title: 'URL shortener', prompt: 'Design for 1k writes/s and 50k reads/s; find the bottleneck and use caching.' }
		],
		resources: { primary: 'system-design-primer', alternative: 'ddia-book' },
		questions: [
			mcq(
				'Main risk of caching?',
				['Slower reads', 'Stale data', 'More DB load', 'Latency'],
				'b',
				'Caching',
				'Invalidation is hard.'
			),
			tf('Queues absorb bursts via async processing.', true, 'Queues and async work', 'Workers drain at a steady rate.'),
			short(
				'Horizontal vs vertical scaling?',
				'Vertical adds resources to one machine; horizontal adds machines and spreads load.',
				['vertical|bigger|single machine|one machine|more (cpu|ram)', 'horizontal|more (machines|servers|instances|nodes)'],
				'Scalability',
				'Horizontal needs stateless services.'
			)
		]
	}
];
