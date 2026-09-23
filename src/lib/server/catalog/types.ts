export type ResourceType = 'documentation' | 'tutorial' | 'course' | 'video' | 'interactive' | 'book' | 'project' | 'exercise' | 'article';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type CatalogResource = {
	slug: string;
	title: string;
	url: string;
	provider: string;
	type: ResourceType;
	difficulty: Difficulty;
	cost: 'free' | 'freemium' | 'paid';
	minutes: number;
	description: string;
	why: string;
	tags: string[];
};

export type CatalogQuestion = {
	type: 'mcq' | 'true_false' | 'short' | 'code';
	prompt: string;
	code?: string;
	/** MCQ option labels; keys a, b, c, d are assigned in order. */
	options?: string[];
	/** mcq: 'a'..'d'; true_false: 'true'|'false'; short/code: reference answer. */
	answer: string;
	/** Case-insensitive regex fragments; each match is evidence of understanding. */
	keywords?: string[];
	explanation: string;
	concept: string;
};

export type CatalogTopic = {
	key: string;
	title: string;
	domain: string;
	description: string;
	difficulty: Difficulty;
	minutes: number;
	/** Skill tags matched against onboarding "existing skills". */
	skills: string[];
	concepts: string[];
	prerequisites: string[];
	practice: { title: string; prompt: string; hint?: string }[];
	resources: { primary: string; alternative?: string; practice?: string; project?: string };
	questions: CatalogQuestion[];
};

export type CatalogProject = {
	key: string;
	title: string;
	goal: string;
	difficulty: Difficulty;
	concepts: string[];
	requirements: string[];
	stack: string[];
	milestones: { title: string; detail: string }[];
	hours: number;
	/** Topic the project reinforces (anchors it in the roadmap). */
	topicKey: string;
};

export type CatalogPhase = {
	title: string;
	description: string;
	milestone: { title: string; detail: string };
	topics: string[];
	project?: string;
};

export type CatalogTrack = {
	slug: string;
	title: string;
	role: string;
	summary: string;
	keywords: string[];
	phases: CatalogPhase[];
};
