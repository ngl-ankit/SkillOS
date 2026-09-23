import type { CatalogTopic } from '../types';
import { mcq, short, tf } from './helpers';

export const DESIGN_BUSINESS_TOPICS: CatalogTopic[] = [
	{
		key: 'design-principles',
		title: 'Visual design principles',
		domain: 'Design',
		description: 'Hierarchy, alignment, contrast, spacing and repetition — what makes interfaces feel clear and intentional.',
		difficulty: 1,
		minutes: 120,
		skills: ['design', 'visual design', 'ui'],
		concepts: ['Visual hierarchy', 'Alignment and grids', 'Contrast', 'Spacing and rhythm', 'Consistency'],
		prerequisites: [],
		practice: [{ title: 'Redesign a screen', prompt: 'Improve a cluttered settings screen using only hierarchy and spacing.' }],
		resources: { primary: 'refactoring-ui', alternative: 'apple-hig', practice: 'laws-of-ux' },
		questions: [
			mcq('Best way to de-emphasise secondary text?', ['Smaller and lower contrast', 'All caps', 'New font', 'Add an icon'], 'a', 'Visual hierarchy', 'Size and contrast.'),
			tf('More whitespace makes interfaces less clear.', false, 'Spacing and rhythm', 'Whitespace groups items.'),
			short(
				'Why use a consistent spacing scale?',
				'It creates rhythm and consistency and speeds decisions because spacing comes from a small set.',
				['consisten|rhythm|harmon|cohes', 'decision|faster|system|predict|choice'],
				'Consistency',
				'Constraints speed design.'
			)
		]
	},
	{
		key: 'typography-color',
		title: 'Typography and color',
		domain: 'Design',
		description: 'Readable type scales and line lengths; accessible color systems with semantic roles and contrast.',
		difficulty: 2,
		minutes: 120,
		skills: ['typography', 'color'],
		concepts: ['Type scale', 'Line length and height', 'Font pairing', 'Color roles', 'Contrast ratios'],
		prerequisites: ['design-principles'],
		practice: [{ title: 'Build a palette', prompt: 'Dark palette with background, surface, text, muted, accent and danger; check 4.5:1.' }],
		resources: { primary: 'practical-typography', alternative: 'material-color', practice: 'wcag-quickref' },
		questions: [
			mcq('Comfortable body line length?', ['20–30 chars', '45–90 chars', '120–150 chars', 'Full width'], 'b', 'Line length and height', 'Long lines are hard to track.'),
			mcq('WCAG AA contrast for normal text?', ['2:1', '3:1', '4.5:1', '7:1'], 'c', 'Contrast ratios', '4.5:1.'),
			tf('Color should never be the only carrier of meaning.', true, 'Color roles', 'Pair with text or icons.')
		]
	},
	{
		key: 'ux-research',
		title: 'UX research and usability',
		domain: 'Design',
		description: 'Interviews, personas, journey maps, usability testing and heuristics.',
		difficulty: 2,
		minutes: 150,
		skills: ['ux', 'user research', 'usability'],
		concepts: ['User interviews', 'Personas and jobs-to-be-done', 'Journey mapping', 'Usability testing', 'Heuristic evaluation'],
		prerequisites: [],
		practice: [
			{ title: 'Five interviews', prompt: 'Interview five people about a problem; summarise patterns without solutions.' },
			{ title: 'Heuristic review', prompt: 'Rank an app’s three worst heuristic violations.' }
		],
		resources: { primary: 'nng-heuristics', alternative: 'nng-user-interviews', practice: 'laws-of-ux' },
		questions: [
			mcq('Least leading interview question?', ['Would you use X?', 'Don’t you hate X?', 'Tell me about the last time you did X.', 'What would you pay?'], 'c', 'User interviews', 'Past behaviour gives facts.'),
			tf('About five users often reveal most major usability problems.', true, 'Usability testing', 'Run small rounds.'),
			short(
				'What is a journey map for?',
				'Visualising steps, emotions and pain points of reaching a goal to find improvement opportunities.',
				['step|stage|phase', 'pain|emotion|frustrat|feel', 'opportunit|improv|fix'],
				'Journey mapping',
				'The whole experience.'
			)
		]
	},
	{
		key: 'prototyping',
		title: 'Wireframing and prototyping',
		domain: 'Design',
		description: 'From sketches to interactive prototypes in Figma; test cheaply and hand off buildable designs.',
		difficulty: 2,
		minutes: 180,
		skills: ['figma', 'prototyping', 'wireframing'],
		concepts: ['Low vs high fidelity', 'Components and variants', 'Auto layout', 'Interactive prototypes', 'Developer handoff'],
		prerequisites: ['design-principles'],
		practice: [{ title: 'Prototype', prompt: 'Wireframe and prototype a 3-screen onboarding; test with two people.' }],
		resources: { primary: 'figma-learn', alternative: 'google-ux-certificate' },
		questions: [
			mcq('Why start low-fidelity?', ['Looks better', 'Fast to change; feedback stays on structure', 'Devs prefer it', 'Final copy'], 'b', 'Low vs high fidelity', 'Cheap artefacts.'),
			tf('Components with variants reduce inconsistency.', true, 'Components and variants', 'Single source of truth.')
		]
	},
	{
		key: 'design-systems',
		title: 'Design systems',
		domain: 'Design',
		description: 'Tokens, components and documentation for consistent products at speed.',
		difficulty: 3,
		minutes: 150,
		skills: ['design systems'],
		concepts: ['Design tokens', 'Atomic design', 'Component APIs', 'Documentation', 'Governance'],
		prerequisites: ['typography-color', 'prototyping'],
		practice: [{ title: 'Token set', prompt: 'Define tokens and build three components using only them.' }],
		resources: { primary: 'atomic-design', alternative: 'material-color' },
		questions: [
			mcq('A design token is…', ['A credential', 'A named reusable design decision', 'A plugin', 'A framework'], 'b', 'Design tokens', 'Keeps design and code in sync.'),
			tf('Molecules combine atoms like a label, input and button.', true, 'Atomic design', 'Atoms → molecules → organisms.')
		]
	},
	{
		key: 'product-discovery',
		title: 'Product discovery and validation',
		domain: 'Product',
		description: 'Find problems worth solving: customer conversations, lean experiments and learning before building.',
		difficulty: 2,
		minutes: 150,
		skills: ['product management', 'product discovery', 'startups'],
		concepts: ['Problem vs solution', 'Customer interviews', 'Assumptions', 'Lean experiments', 'MVP'],
		prerequisites: [],
		practice: [
			{ title: 'Assumption map', prompt: 'Rank 10 risky assumptions and design cheap tests for the top three.' },
			{ title: 'Mom Test interviews', prompt: 'Three interviews using only past-behaviour questions.' }
		],
		resources: { primary: 'yc-talk-to-users', alternative: 'mom-test', practice: 'yc-library' },
		questions: [
			mcq('Main purpose of an MVP?', ['Polished launch', 'Learn if core assumptions hold with minimal effort', 'Fundraising', 'Impress competitors'], 'b', 'MVP', 'A learning tool.'),
			tf('Compliments are strong evidence of demand.', false, 'Customer interviews', 'Commitment is evidence.'),
			short(
				'Why focus on the problem before the solution?',
				'Understanding the real problem and who has it avoids building something nobody needs.',
				['need|want|nobody|demand', 'understand|real|pain|who'],
				'Problem vs solution',
				'Most products fail from lack of demand.'
			)
		]
	},
	{
		key: 'business-models',
		title: 'Business models and strategy',
		domain: 'Business',
		description: 'How businesses create, deliver and capture value: segments, value propositions, revenue and unit economics.',
		difficulty: 2,
		minutes: 150,
		skills: ['business', 'strategy', 'entrepreneurship'],
		concepts: ['Business model canvas', 'Value proposition', 'Revenue models', 'Unit economics', 'Competitive advantage'],
		prerequisites: ['product-discovery'],
		practice: [
			{ title: 'Canvas a company', prompt: 'Business Model Canvas for a company you use, then your idea.' },
			{ title: 'Unit economics', prompt: 'Estimate CAC and LTV for a subscription product.' }
		],
		resources: { primary: 'business-model-canvas', alternative: 'pg-essays', practice: 'yc-library' },
		questions: [
			mcq('Sustainable subscriptions need…', ['CAC > LTV', 'LTV comfortably > CAC', 'Zero churn', 'Lowest price'], 'b', 'Unit economics', 'Customers worth more than they cost.'),
			tf('A value proposition explains why a segment chooses you.', true, 'Value proposition', 'Links pains to your offer.')
		]
	},
	{
		key: 'metrics-growth',
		title: 'Metrics and growth',
		domain: 'Product',
		description: 'North Star metrics, activation, retention, funnels and responsible experiments.',
		difficulty: 3,
		minutes: 120,
		skills: ['analytics', 'growth', 'metrics'],
		concepts: ['North Star metric', 'Activation', 'Retention cohorts', 'Funnels', 'A/B testing'],
		prerequisites: ['product-discovery'],
		practice: [{ title: 'Metric tree', prompt: 'Define a North Star and 3–5 input metrics.' }],
		resources: { primary: 'north-star-playbook', alternative: 'svpg-inspired', practice: 'yc-library' },
		questions: [
			mcq('Strongest product–market fit signal?', ['Sign-ups', 'Page views', 'Retention', 'Followers'], 'c', 'Retention cohorts', 'Returning users.'),
			tf('A North Star reflects customer value, not just revenue.', true, 'North Star metric', 'Revenue lags value.')
		]
	},
	{
		key: 'product-management',
		title: 'Product management in practice',
		domain: 'Product',
		description: 'Prioritisation, outcome roadmaps, specs, cross-functional work and iterative shipping.',
		difficulty: 3,
		minutes: 150,
		skills: ['product management'],
		concepts: ['Prioritisation', 'Outcome-based roadmaps', 'Writing specs', 'Cross-functional teams', 'Iterative delivery'],
		prerequisites: ['product-discovery', 'metrics-growth'],
		practice: [{ title: 'One-page spec', prompt: 'Problem, users, metric, scope, non-goals, open questions.' }],
		resources: { primary: 'svpg-inspired', alternative: 'yc-library' },
		questions: [
			mcq('Outcome-based roadmaps focus on…', ['Feature dates', 'Problems and measurable outcomes', 'Tasks', 'Competitors'], 'b', 'Outcome-based roadmaps', 'Room for the best solution.'),
			short(
				'Why include non-goals in a spec?',
				'They set scope boundaries, prevent scope creep and align the team.',
				['scope', 'align|clear|expectation|creep|focus'],
				'Writing specs',
				'Saying no clearly.'
			)
		]
	}
];
