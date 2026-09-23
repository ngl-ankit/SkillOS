import type { CatalogPhase, CatalogTrack } from './types';

const phase = (
	title: string,
	description: string,
	milestone: [string, string],
	topics: string[],
	project?: string
): CatalogPhase => ({
	title,
	description,
	milestone: { title: milestone[0], detail: milestone[1] },
	topics,
	project
});

/** Roadmap blueprints. The roadmap engine personalises these per learner. */
export const TRACKS: CatalogTrack[] = [
	{
		slug: 'full-stack-developer',
		title: 'Full Stack Developer',
		role: 'Full Stack Developer',
		summary: 'From how the web works to shipping authenticated, tested, deployed full-stack applications.',
		keywords: ['full stack', 'fullstack', 'web developer', 'software engineer', 'developer', 'web dev', 'programmer'],
		phases: [
			phase(
				'Foundations',
				'The web, the terminal, Git and the structure and style of pages.',
				['Ship a responsive site', 'A deployed, accessible personal site.'],
				[
					'how-the-web-works',
					'cli-basics',
					'git-basics',
					'html-semantics',
					'css-fundamentals',
					'css-layout',
					'responsive-design'
				],
				'personal-site'
			),
			phase(
				'JavaScript',
				'The language of the web, from fundamentals to async and tooling.',
				['Interactive app without a framework', 'A vanilla JS app with real state.'],
				['js-fundamentals', 'js-data-structures', 'dom-events', 'js-scope-closures', 'async-js', 'js-modules-tooling'],
				'interactive-todo'
			),
			phase(
				'Modern frontend',
				'Types, components, accessibility, testing and performance.',
				['Typed, tested frontend', 'A component app with proper states and tests.'],
				['typescript', 'components-state', 'accessibility', 'frontend-testing', 'web-performance'],
				'api-dashboard'
			),
			phase(
				'Backend and data',
				'Servers, APIs, SQL, data modeling and security.',
				['Secure API', 'An authenticated API with per-user isolation.'],
				['node-basics', 'rest-apis', 'sql-fundamentals', 'data-modeling', 'auth-security'],
				'notes-api'
			),
			phase(
				'Ship to production',
				'Deployment, CI and system design fundamentals.',
				['Production capstone', 'A deployed full-stack app with CI and real users.'],
				['deployment-devops', 'system-design-basics'],
				'fullstack-capstone'
			)
		]
	},
	{
		slug: 'frontend-developer',
		title: 'Frontend Developer',
		role: 'Frontend Developer',
		summary: 'Accessible, fast, well-tested interfaces with modern JavaScript, TypeScript and components.',
		keywords: ['frontend', 'front-end', 'front end', 'ui developer', 'react', 'svelte', 'vue'],
		phases: [
			phase(
				'Web foundations',
				'How the web works and the structure and style of pages.',
				['Responsive site', 'A deployed, accessible personal site.'],
				[
					'how-the-web-works',
					'cli-basics',
					'git-basics',
					'html-semantics',
					'css-fundamentals',
					'css-layout',
					'responsive-design',
					'accessibility'
				],
				'personal-site'
			),
			phase(
				'JavaScript',
				'Language fundamentals through async and tooling.',
				['Vanilla JS app', 'Interactive app with persistent state.'],
				['js-fundamentals', 'js-data-structures', 'dom-events', 'js-scope-closures', 'async-js', 'js-modules-tooling'],
				'interactive-todo'
			),
			phase(
				'Professional frontend',
				'TypeScript, components, testing and performance.',
				['Production-quality UI', 'Typed, tested and fast.'],
				['typescript', 'components-state', 'frontend-testing', 'web-performance', 'design-principles'],
				'api-dashboard'
			)
		]
	},
	{
		slug: 'backend-developer',
		title: 'Backend Developer',
		role: 'Backend Developer',
		summary: 'APIs, databases, security and deployment for reliable server-side systems.',
		keywords: ['backend', 'back-end', 'back end', 'api', 'server', 'node'],
		phases: [
			phase(
				'Foundations',
				'The web, the terminal, Git and core JavaScript.',
				['Solid fundamentals', 'Comfortable with JS and the command line.'],
				[
					'how-the-web-works',
					'cli-basics',
					'git-basics',
					'js-fundamentals',
					'js-data-structures',
					'js-scope-closures',
					'async-js',
					'js-modules-tooling'
				]
			),
			phase(
				'APIs and data',
				'Servers, REST, SQL and data modeling.',
				['Data-backed API', 'A validated REST API on PostgreSQL.'],
				['typescript', 'node-basics', 'rest-apis', 'sql-fundamentals', 'data-modeling']
			),
			phase(
				'Production backend',
				'Security, deployment and system design.',
				['Secure deployed API', 'Authenticated, tested and deployed.'],
				['auth-security', 'deployment-devops', 'system-design-basics'],
				'notes-api'
			)
		]
	},
	{
		slug: 'data-analyst',
		title: 'Data Analyst',
		role: 'Data Analyst',
		summary: 'Python, SQL, statistics and visualisation to turn data into honest, useful answers.',
		keywords: ['data analyst', 'data analysis', 'analytics', 'business intelligence', 'excel'],
		phases: [
			phase(
				'Tools',
				'Python and SQL for working with data.',
				['Query and script', 'Answer questions with SQL and Python.'],
				['python-basics', 'sql-fundamentals', 'python-oop']
			),
			phase(
				'Analysis',
				'Wrangling, statistics and visualisation.',
				['Data story', 'A published, honest analysis.'],
				['numpy-pandas', 'statistics', 'data-visualization', 'data-modeling'],
				'data-story'
			),
			phase(
				'Impact',
				'Metrics and working with product teams.',
				['Metric tree', 'Connect analysis to decisions.'],
				['product-discovery', 'metrics-growth']
			)
		]
	},
	{
		slug: 'ml-engineer',
		title: 'AI / Machine Learning Engineer',
		role: 'Machine Learning Engineer',
		summary: 'From Python and math foundations through classical ML, deep learning and LLM applications.',
		keywords: [
			'machine learning',
			'ml',
			' ai',
			'ai ',
			'artificial intelligence',
			'deep learning',
			'llm',
			'data scientist',
			'data science'
		],
		phases: [
			phase(
				'Foundations',
				'Python, data tools and the math behind ML.',
				['Data fluency', 'Comfortable with pandas and statistics.'],
				['python-basics', 'python-oop', 'numpy-pandas', 'statistics', 'linear-algebra'],
				'data-story'
			),
			phase(
				'Classical ML',
				'Supervised learning and honest evaluation.',
				['Evaluated model', 'A cross-validated model with a model card.'],
				['data-visualization', 'ml-foundations', 'model-evaluation'],
				'ml-predictor'
			),
			phase(
				'Deep learning and LLMs',
				'Neural networks, transformers and AI products.',
				['AI application', 'A grounded, evaluated LLM app.'],
				['neural-networks', 'llms-transformers', 'llm-apps'],
				'rag-assistant'
			)
		]
	},
	{
		slug: 'computer-science',
		title: 'Computer Science Fundamentals',
		role: 'Software Engineer',
		summary: 'Problem solving, data structures, algorithms, operating systems and networks.',
		keywords: ['computer science', 'algorithms', 'data structures', 'dsa', 'interview', 'leetcode'],
		phases: [
			phase(
				'Thinking in code',
				'Problem solving with Python.',
				['Confident programmer', 'Decompose and debug problems.'],
				['programming-logic', 'python-basics', 'python-oop', 'cli-basics', 'git-basics']
			),
			phase(
				'Data structures and algorithms',
				'The core toolkit and its analysis.',
				['Algorithms toolkit', 'Tested implementations.'],
				['data-structures', 'algorithms-complexity'],
				'algo-toolkit'
			),
			phase(
				'Systems',
				'What happens beneath your programs.',
				['Systems literacy', 'Explain processes, memory and networks.'],
				['how-the-web-works', 'operating-systems', 'networking', 'sql-fundamentals']
			)
		]
	},
	{
		slug: 'product-designer',
		title: 'Product / UX Designer',
		role: 'Product Designer',
		summary: 'Research, visual design, prototyping and design systems for products people love.',
		keywords: ['design', 'designer', 'ux', 'ui', 'product design', 'figma', 'user experience'],
		phases: [
			phase(
				'Design fundamentals',
				'Hierarchy, type, color and accessible structure.',
				['Visual foundations', 'Redesign screens with intent.'],
				['design-principles', 'typography-color', 'how-the-web-works', 'html-semantics', 'accessibility']
			),
			phase(
				'UX process',
				'Research, prototyping and testing.',
				['Case study', 'A researched, tested redesign.'],
				['ux-research', 'prototyping', 'css-fundamentals'],
				'redesign-case-study'
			),
			phase(
				'Systems and product',
				'Scale your design work.',
				['Design system', 'Tokens and components in use.'],
				['design-systems', 'product-discovery']
			)
		]
	},
	{
		slug: 'product-business',
		title: 'Product & Business',
		role: 'Product Manager / Founder',
		summary: 'Discover problems worth solving, validate ideas, understand business models and drive outcomes.',
		keywords: [
			'business',
			'product manager',
			'startup',
			'founder',
			'entrepreneur',
			'product management',
			'marketing',
			'strategy'
		],
		phases: [
			phase(
				'Discovery',
				'Customers, problems and evidence.',
				['Validated problem', 'Evidence from real conversations.'],
				['product-discovery', 'ux-research']
			),
			phase(
				'Business',
				'How value is created and captured.',
				['Viable model', 'A canvas and unit economics.'],
				['business-models', 'metrics-growth', 'statistics'],
				'validate-idea'
			),
			phase(
				'Delivery',
				'Working with teams to ship outcomes.',
				['Shipping cadence', 'Specs and roadmaps that drive outcomes.'],
				['product-management', 'design-principles', 'how-the-web-works']
			)
		]
	}
];
