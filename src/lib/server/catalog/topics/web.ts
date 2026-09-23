import type { CatalogTopic } from '../types';
import { code, mcq, short, tf } from './helpers';

export const WEB_TOPICS: CatalogTopic[] = [
	{
		key: 'how-the-web-works',
		title: 'How the web works',
		domain: 'Web Foundations',
		description:
			'What happens between typing a URL and seeing a page: DNS, TCP, HTTP requests and responses, and how browsers render what servers send back.',
		difficulty: 1,
		minutes: 90,
		skills: ['web', 'http', 'internet'],
		concepts: ['Client and server', 'DNS resolution', 'HTTP request/response', 'Status codes', 'HTTPS/TLS'],
		prerequisites: [],
		practice: [
			{
				title: 'Trace a request',
				prompt: 'Open DevTools → Network, load any site and note the method, status code and three response headers of the main document.',
				hint: 'Filter by "Doc" to find the HTML document.'
			},
			{ title: 'Explain it simply', prompt: 'In five sentences, explain to a non-technical friend what happens when they visit a website.' }
		],
		resources: { primary: 'mdn-http-overview', alternative: 'cloudflare-learning', practice: 'freecodecamp' },
		questions: [
			mcq('What does DNS do?', ['Encrypts traffic', 'Translates a domain name into an IP address', 'Renders HTML', 'Stores cookies'], 'b', 'DNS resolution', 'DNS resolves names like example.com to an IP address.'),
			mcq('Which status code range indicates a client error?', ['2xx', '3xx', '4xx', '5xx'], 'c', 'Status codes', '4xx means the request was wrong; 5xx means the server failed.'),
			tf('HTTP is stateless: each request is independent unless state is added, e.g. with cookies.', true, 'HTTP request/response', 'Sessions are layered on top of HTTP.'),
			short(
				'Why is HTTPS important even for sites without passwords?',
				'HTTPS encrypts traffic so it cannot be read or modified in transit, protecting integrity and privacy.',
				['encrypt', 'tamper|modif|integrity|inject', 'privacy|read|intercept|eavesdrop'],
				'HTTPS/TLS',
				'TLS prevents eavesdropping and tampering, e.g. injected scripts on public Wi-Fi.'
			)
		]
	},
	{
		key: 'cli-basics',
		title: 'Command line essentials',
		domain: 'Developer Tools',
		description: 'Navigate the file system, run programs and combine small tools with pipes. The terminal is where builds, Git and deployments live.',
		difficulty: 1,
		minutes: 75,
		skills: ['cli', 'terminal', 'shell', 'bash', 'linux'],
		concepts: ['Paths and navigation', 'Files and directories', 'Pipes and redirection', 'Environment variables', 'Permissions'],
		prerequisites: [],
		practice: [
			{ title: 'Scaffold from the terminal', prompt: 'Create "playground" with src/index.html and README.md using only the terminal, then list the tree.', hint: 'mkdir -p, touch, ls -R' },
			{ title: 'Pipe it', prompt: 'Count lines containing "error" in a file with one piped command.', hint: 'grep … | wc -l' }
		],
		resources: { primary: 'missing-semester-shell', alternative: 'missing-semester' },
		questions: [
			mcq('What does `|` do in a shell command?', ['Runs commands in parallel', 'Sends output of one command as input to the next', 'Writes to a file', 'Runs on failure'], 'b', 'Pipes and redirection', 'A pipe connects stdout to stdin.'),
			mcq('Which command prints your current directory?', ['cd', 'ls', 'pwd', 'whoami'], 'c', 'Paths and navigation', 'pwd = print working directory.'),
			tf('`>` appends to a file while `>>` overwrites it.', false, 'Pipes and redirection', 'The reverse: > overwrites, >> appends.'),
			short(
				'What is the difference between an absolute and a relative path?',
				'An absolute path starts from the root (/) and works anywhere; a relative path is resolved from the current directory.',
				['root|^/|\\s/', 'current|working|where you are'],
				'Paths and navigation',
				'Absolute paths are unambiguous; relative paths depend on location.'
			)
		]
	},
	{
		key: 'git-basics',
		title: 'Version control with Git',
		domain: 'Developer Tools',
		description: 'Track changes, work on branches and collaborate through remotes. Git gives you a safety net and a history of every decision.',
		difficulty: 2,
		minutes: 120,
		skills: ['git', 'github', 'version control'],
		concepts: ['Commits and staging', 'Branches', 'Merging', 'Remotes and pushing', 'Resolving conflicts'],
		prerequisites: ['cli-basics'],
		practice: [
			{ title: 'Branch and merge', prompt: 'Change the same line on main and a feature branch, merge, and resolve the conflict.' },
			{ title: 'Publish', prompt: 'Push a repository to GitHub with a README explaining it.' }
		],
		resources: { primary: 'pro-git', alternative: 'missing-semester', practice: 'learn-git-branching' },
		questions: [
			mcq('What does `git add` do?', ['Creates a commit', 'Stages changes for the next commit', 'Uploads to GitHub', 'Creates a branch'], 'b', 'Commits and staging', 'add stages; commit records.'),
			tf('A Git branch is a lightweight movable pointer to a commit.', true, 'Branches', 'Which is why branches are cheap.'),
			mcq('When does a merge conflict happen?', ['Different file names', 'Same lines changed differently on both branches', 'Forgetting to pull', 'Empty message'], 'b', 'Resolving conflicts', 'Git cannot choose between two edits of the same lines.'),
			short(
				'Why commit small, focused changes with clear messages?',
				'Small commits are easier to review, revert and understand; messages explain why a change was made.',
				['review|understand|read', 'revert|undo|bisect|history|debug', 'why|reason|context'],
				'Commits and staging',
				'History is documentation.'
			)
		]
	},
	{
		key: 'html-semantics',
		title: 'Semantic HTML',
		domain: 'Web Foundations',
		description: 'Structure content with meaningful elements so browsers, search engines and assistive technology understand the page.',
		difficulty: 1,
		minutes: 120,
		skills: ['html'],
		concepts: ['Document structure', 'Semantic elements', 'Headings hierarchy', 'Forms and labels', 'Links vs buttons'],
		prerequisites: ['how-the-web-works'],
		practice: [
			{ title: 'Mark up an article', prompt: 'Write a blog post page with header, nav, main, article, aside and footer, one h1 and logical headings.' },
			{ title: 'Accessible form', prompt: 'Build a sign-up form with labelled name, email and password fields and a submit button.' }
		],
		resources: { primary: 'mdn-learn-html', alternative: 'webdev-learn-html', practice: 'freecodecamp', project: 'frontend-mentor' },
		questions: [
			mcq('Which element wraps the primary, unique content of a page?', ['<section>', '<div id="content">', '<main>', '<article>'], 'c', 'Semantic elements', '<main> is the dominant-content landmark.'),
			mcq('A control that performs an action without navigating should be…', ['<a href="#">', '<button>', '<div onclick>', '<span role="link">'], 'b', 'Links vs buttons', 'Buttons act; links navigate.'),
			tf('Placeholder text can replace a <label>.', false, 'Forms and labels', 'Placeholders disappear and are not reliably announced.'),
			short(
				'Why does semantic HTML matter if divs look the same?',
				'Semantics give meaning to assistive technology, search engines and browsers, enabling navigation by landmarks and headings.',
				['screen reader|assistive|accessib', 'search|seo|crawler', 'meaning|structure|landmark'],
				'Semantic elements',
				'Visual appearance is only one consumer of HTML.'
			)
		]
	},
	{
		key: 'css-fundamentals',
		title: 'CSS fundamentals',
		domain: 'Web Foundations',
		description: 'Selectors, the cascade, specificity and the box model — the rules deciding which styles apply and how much space things take.',
		difficulty: 1,
		minutes: 150,
		skills: ['css'],
		concepts: ['Selectors', 'Cascade and specificity', 'Box model', 'Units', 'Inheritance'],
		prerequisites: ['html-semantics'],
		practice: [
			{ title: 'Specificity puzzle', prompt: 'Write element, class and id rules for one paragraph and predict which color wins.' },
			{ title: 'Box model card', prompt: 'Style a card with border-box sizing so its total width is exactly 320px.' }
		],
		resources: { primary: 'mdn-learn-css', alternative: 'webdev-learn-css', practice: 'freecodecamp' },
		questions: [
			mcq('Which selector has the highest specificity?', ['p', '.card p', '#intro', 'div p span'], 'c', 'Cascade and specificity', 'IDs outweigh classes and elements.'),
			mcq('With `box-sizing: border-box`, width includes…', ['Content', 'Content + padding', 'Content + padding + border', 'Everything incl. margin'], 'c', 'Box model', 'Margin is always outside.'),
			tf('`rem` is relative to the root element’s font size.', true, 'Units', 'em is relative to the element itself.'),
			short(
				'Explain the cascade in one or two sentences.',
				'When several rules apply, the browser picks by importance/origin, then specificity, then source order (later wins).',
				['specific', 'order|later|last', 'importan|origin'],
				'Cascade and specificity',
				'Importance → specificity → order.'
			)
		]
	},
	{
		key: 'css-layout',
		title: 'Layout with Flexbox and Grid',
		domain: 'Web Foundations',
		description: 'Arrange elements in one dimension with Flexbox and two with Grid — tools that handle nearly every modern layout.',
		difficulty: 2,
		minutes: 150,
		skills: ['flexbox', 'grid', 'layout'],
		concepts: ['Flex container and items', 'Main vs cross axis', 'Grid tracks and areas', 'fr unit', 'gap'],
		prerequisites: ['css-fundamentals'],
		practice: [
			{ title: 'Navbar', prompt: 'Logo left, links right, flexbox only.', hint: 'justify-content: space-between' },
			{ title: 'Dashboard grid', prompt: 'Header/sidebar/main/footer layout with grid-template-areas.' }
		],
		resources: { primary: 'css-tricks-flexbox', alternative: 'css-tricks-grid', practice: 'flexbox-froggy', project: 'frontend-mentor' },
		questions: [
			mcq('In a row flex container, which property aligns items vertically?', ['justify-content', 'align-items', 'flex-direction', 'place-content'], 'b', 'Main vs cross axis', 'align-items works on the cross axis.'),
			mcq('`grid-template-columns: 1fr 2fr` produces…', ['1px and 2px columns', 'Two columns, second twice as wide', 'Two rows', 'Three columns'], 'b', 'fr unit', 'fr shares free space proportionally.'),
			tf('Grid suits 2D layouts; Flexbox suits 1D layouts.', true, 'Grid tracks and areas', 'Grid controls rows and columns together.'),
			code(
				'Center a single child horizontally and vertically inside `.box` with flexbox.',
				'.box { display: flex; justify-content: center; align-items: center; }',
				['display:\\s*flex', 'justify-content:\\s*center', 'align-items:\\s*center'],
				'Flex container and items',
				'justify-content = main axis, align-items = cross axis.'
			)
		]
	},
	{
		key: 'responsive-design',
		title: 'Responsive design',
		domain: 'Web Foundations',
		description: 'Make layouts adapt from phones to wide screens with fluid sizing, media queries and responsive images — mobile-first.',
		difficulty: 2,
		minutes: 90,
		skills: ['responsive'],
		concepts: ['Viewport meta', 'Mobile-first', 'Media queries', 'Fluid units', 'Responsive images'],
		prerequisites: ['css-layout'],
		practice: [
			{ title: 'Mobile-first grid', prompt: 'Cards: 1 column on phones, 2 on tablets, 3 on desktop, mobile styles first.' },
			{ title: 'Audit', prompt: 'List three ways a site you like adapts to small screens.' }
		],
		resources: { primary: 'webdev-responsive', alternative: 'webdev-learn-css', project: 'frontend-mentor' },
		questions: [
			mcq('"Mobile-first" CSS means…', ['Phones only', 'Base styles for small screens, min-width queries for larger', 'max-width queries everywhere', 'A separate mobile site'], 'b', 'Mobile-first', 'Start simple, enhance with space.'),
			tf('Without the viewport meta tag, mobile browsers may render at desktop width.', true, 'Viewport meta', 'width=device-width fixes it.'),
			code('Write a media query for viewports at least 768px wide.', '@media (min-width: 768px) { ... }', ['@media', 'min-width:\\s*768px'], 'Media queries', 'min-width layers larger-screen styles.')
		]
	},
	{
		key: 'accessibility',
		title: 'Web accessibility',
		domain: 'Web Foundations',
		description: 'Build interfaces everyone can use: keyboard navigation, focus management, contrast, alt text and when (not) to use ARIA.',
		difficulty: 2,
		minutes: 120,
		skills: ['accessibility', 'a11y'],
		concepts: ['Keyboard navigation', 'Focus management', 'Color contrast', 'Alt text', 'ARIA roles'],
		prerequisites: ['html-semantics'],
		practice: [
			{ title: 'Keyboard-only test', prompt: 'Navigate a site with Tab, Shift+Tab, Enter and Space only; list where you got stuck.' },
			{ title: 'Contrast fix', prompt: 'Find and fix two text/background pairs failing WCAG AA.' }
		],
		resources: { primary: 'webdev-accessibility', alternative: 'wcag-quickref' },
		questions: [
			mcq('The first rule of ARIA is…', ['Always add roles', 'Prefer native HTML elements when one exists', 'aria-label everything', 'ARIA replaces HTML'], 'b', 'ARIA roles', 'Native elements include semantics and keyboard support.'),
			mcq('Alt text for a purely decorative image?', ['alt="image"', 'alt="decorative"', 'alt=""', 'No alt'], 'c', 'Alt text', 'Empty alt tells assistive tech to skip it.'),
			tf('`outline: none` is fine if the site looks cleaner.', false, 'Focus management', 'Keyboard users need visible focus.')
		]
	}
];
