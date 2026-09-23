import type { CatalogProject } from './types';

type M = [string, string];
const ms = (...items: M[]) => items.map(([title, detail]) => ({ title, detail }));

/** Project briefs. Each reinforces a roadmap topic; guidance, never full solutions. */
export const PROJECTS: CatalogProject[] = [
	{
		key: 'personal-site',
		title: 'Responsive personal site',
		goal: 'Publish a fast, accessible personal site that introduces you and links to your work.',
		difficulty: 1,
		concepts: ['Semantic HTML', 'Flexbox and Grid', 'Responsive design', 'Accessibility'],
		requirements: [
			'Home, about and projects sections with a logical heading structure',
			'Layout adapts from 360px phones to wide desktops',
			'Keyboard-navigable with visible focus styles',
			'Deployed publicly'
		],
		stack: ['HTML', 'CSS', 'Git', 'A static host'],
		milestones: ms(
			['Content outline', 'Write copy and heading structure in plain HTML.'],
			['Mobile layout', 'Style the phone layout with flexbox.'],
			['Desktop layout', 'Add min-width media queries and a project grid.'],
			['Accessibility pass', 'Check contrast, alt text and keyboard flow.'],
			['Ship it', 'Push to GitHub and deploy.']
		),
		hours: 6,
		topicKey: 'responsive-design'
	},
	{
		key: 'interactive-todo',
		title: 'Interactive task board',
		goal: 'Build a vanilla JavaScript task board with filters and persistence — no frameworks.',
		difficulty: 2,
		concepts: ['DOM manipulation', 'Event delegation', 'Array methods', 'localStorage'],
		requirements: [
			'Add, edit, complete and delete tasks',
			'Filter all / active / done with a live count',
			'State survives reloads via localStorage',
			'One delegated listener handles list interactions'
		],
		stack: ['HTML', 'CSS', 'JavaScript'],
		milestones: ms(
			['Data model', 'Represent tasks as objects and render from state.'],
			['Interactions', 'Wire actions through event delegation.'],
			['Filters', 'Derive the visible list from state + filter.'],
			['Persistence', 'Save and load safely, handling corrupt data.']
		),
		hours: 6,
		topicKey: 'dom-events'
	},
	{
		key: 'api-dashboard',
		title: 'Live data dashboard',
		goal: 'Fetch data from a public API and present it with loading, empty and error states.',
		difficulty: 3,
		concepts: ['fetch', 'async/await', 'Error handling', 'Components'],
		requirements: [
			'Fetch and render from a public JSON API',
			'Explicit loading, empty and error states with retry',
			'Filtering that does not refetch',
			'No unhandled promise rejections'
		],
		stack: ['TypeScript', 'A component framework', 'Vite'],
		milestones: ms(
			['Fetch layer', 'Typed fetch helper that checks response.ok.'],
			['UI states', 'Design all four states first.'],
			['Interaction', 'Client-side filtering with derived state.'],
			['Polish', 'Cache results to avoid refetching.']
		),
		hours: 8,
		topicKey: 'components-state'
	},
	{
		key: 'notes-api',
		title: 'Authenticated notes API',
		goal: 'Build a REST API where each user can manage only their own notes.',
		difficulty: 3,
		concepts: ['REST design', 'SQL', 'Authentication', 'Authorization', 'Validation'],
		requirements: [
			'Sign up and log in with hashed passwords and secure cookies',
			'Validated CRUD endpoints for notes',
			'Every query scoped to the authenticated user',
			'Tests proving ownership rules'
		],
		stack: ['Node or Bun', 'PostgreSQL', 'An ORM or query builder'],
		milestones: ms(
			['Schema', 'Users and notes with keys and constraints.'],
			['Auth', 'Sign-up/login with sessions.'],
			['CRUD', 'Endpoints with validation.'],
			['Authorization tests', 'Prove user A cannot touch user B’s notes.']
		),
		hours: 12,
		topicKey: 'auth-security'
	},
	{
		key: 'fullstack-capstone',
		title: 'Full-stack capstone: habit tracker',
		goal: 'Design, build, test and deploy a complete full-stack app used by real people.',
		difficulty: 4,
		concepts: ['Data modeling', 'API design', 'Frontend state', 'Testing', 'Deployment'],
		requirements: [
			'Accounts, habits, daily check-ins and streaks',
			'Responsive UI with loading and error states',
			'Unit tests for streak logic and one E2E test',
			'CI and a production deployment'
		],
		stack: ['TypeScript', 'SvelteKit or similar', 'PostgreSQL', 'Playwright'],
		milestones: ms(
			['Spec and schema', 'One-page spec and data model.'],
			['Core loop', 'Create habits and check in.'],
			['Streaks', 'Implement and test streaks, including time zones.'],
			['Quality', 'E2E, accessibility and performance pass.'],
			['Deploy', 'Ship with CI and get feedback from three users.']
		),
		hours: 30,
		topicKey: 'deployment-devops'
	},
	{
		key: 'data-story',
		title: 'Exploratory data story',
		goal: 'Answer three real questions about a public dataset and present findings honestly.',
		difficulty: 2,
		concepts: ['pandas', 'Data cleaning', 'Visualisation', 'Statistics'],
		requirements: ['Document every cleaning decision', 'Three questions, one chart each', 'State limitations clearly'],
		stack: ['Python', 'pandas', 'seaborn', 'Jupyter'],
		milestones: ms(
			['Pick a dataset', 'Choose data and write three questions.'],
			['Clean', 'Fix types and missing values.'],
			['Analyse', 'Group, aggregate and chart.'],
			['Write up', 'Tell the story in under 800 words.']
		),
		hours: 8,
		topicKey: 'data-visualization'
	},
	{
		key: 'ml-predictor',
		title: 'Tabular ML predictor',
		goal: 'Train, evaluate and explain a model on a real tabular dataset.',
		difficulty: 3,
		concepts: ['Train/test split', 'Pipelines', 'Evaluation metrics', 'Baselines'],
		requirements: [
			'Baseline plus two model types',
			'Cross-validated, problem-appropriate metrics',
			'Leakage-free pipeline',
			'A short model card'
		],
		stack: ['Python', 'scikit-learn', 'pandas'],
		milestones: ms(
			['Baseline', 'Establish a trivial baseline.'],
			['Pipeline', 'Preprocessing + model in one pipeline.'],
			['Evaluate', 'Cross-validate with the right metric.'],
			['Model card', 'Document results and limitations.']
		),
		hours: 10,
		topicKey: 'model-evaluation'
	},
	{
		key: 'rag-assistant',
		title: 'Retrieval-augmented study assistant',
		goal: 'Build an assistant that answers from your own documents and cites sources.',
		difficulty: 4,
		concepts: ['Embeddings', 'Vector search', 'Prompt design', 'Evaluation', 'Failure handling'],
		requirements: [
			'Chunk and embed documents into pgvector',
			'Grounded answers with citations',
			'Graceful model failure handling',
			'An evaluation set of 15+ questions'
		],
		stack: ['TypeScript or Python', 'PostgreSQL + pgvector', 'An LLM API'],
		milestones: ms(
			['Ingest', 'Chunk and store embeddings.'],
			['Retrieve', 'Similarity search and inspection.'],
			['Generate', 'Prompt with context and cite sources.'],
			['Evaluate', 'Score answers and iterate.']
		),
		hours: 14,
		topicKey: 'llm-apps'
	},
	{
		key: 'algo-toolkit',
		title: 'Algorithms toolkit',
		goal: 'Implement and test core data structures and algorithms from scratch.',
		difficulty: 3,
		concepts: ['Stacks and queues', 'Hash tables', 'Binary search', 'Graph traversal'],
		requirements: ['Stack, queue, hash map and BST with tests', 'BFS and DFS', 'README with complexities'],
		stack: ['Any language with a test runner'],
		milestones: ms(
			['Linear structures', 'Stack and queue.'],
			['Hashing', 'Hash map with resizing.'],
			['Trees and graphs', 'BST plus BFS/DFS.']
		),
		hours: 12,
		topicKey: 'algorithms-complexity'
	},
	{
		key: 'redesign-case-study',
		title: 'App redesign case study',
		goal: 'Research, redesign and test one flow of an existing app, written as a portfolio case study.',
		difficulty: 2,
		concepts: ['User interviews', 'Heuristic evaluation', 'Prototyping', 'Usability testing'],
		requirements: [
			'Evidence from three user conversations',
			'Before/after screens with rationale',
			'A tested prototype',
			'A written case study'
		],
		stack: ['Figma'],
		milestones: ms(
			['Research', 'Interviews and heuristic review.'],
			['Define', 'Pick the worst problem; write a brief.'],
			['Prototype', 'Wireframe then prototype.'],
			['Test and write up', 'Test and document.']
		),
		hours: 12,
		topicKey: 'prototyping'
	},
	{
		key: 'validate-idea',
		title: 'Validate a product idea',
		goal: 'Take an idea from assumption to evidence in two weeks without production code.',
		difficulty: 2,
		concepts: ['Customer interviews', 'Assumption mapping', 'Lean experiments', 'Business model canvas'],
		requirements: [
			'Assumption map',
			'Five customer conversations',
			'One experiment with a pre-set threshold',
			'A go / pivot / stop memo'
		],
		stack: ['Docs', 'A landing page or form tool'],
		milestones: ms(
			['Assumptions', 'Map and rank.'],
			['Conversations', 'Interview five people.'],
			['Experiment', 'Run one cheap test.'],
			['Decide', 'Write the memo.']
		),
		hours: 10,
		topicKey: 'business-models'
	}
];
