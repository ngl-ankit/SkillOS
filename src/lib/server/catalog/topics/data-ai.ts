import type { CatalogTopic } from '../types';
import { code, mcq, short, tf } from './helpers';

export const DATA_AI_TOPICS: CatalogTopic[] = [
	{
		key: 'python-basics',
		title: 'Python fundamentals',
		domain: 'Python',
		description: 'Variables, types, control flow, functions, lists, dicts and modules — enough Python for useful scripts and data code.',
		difficulty: 1,
		minutes: 240,
		skills: ['python'],
		concepts: ['Types and variables', 'Control flow', 'Functions', 'Lists and dicts', 'Comprehensions', 'Modules'],
		prerequisites: [],
		practice: [
			{ title: 'Word frequency', prompt: 'Print the 10 most common words in a text file, case-insensitive.', hint: 'collections.Counter' },
			{ title: 'Comprehensions', prompt: 'Rewrite three loops as comprehensions.' }
		],
		resources: { primary: 'python-tutorial', alternative: 'automate-boring-stuff', practice: 'exercism-python', project: 'automate-boring-stuff' },
		questions: [
			mcq('`[x * 2 for x in range(3)]` evaluates to…', ['[0, 2, 4]', '[2, 4, 6]', '[0, 1, 2]', '(0, 2, 4)'], 'a', 'Comprehensions', 'range(3) yields 0, 1, 2.'),
			mcq('Which type is immutable?', ['list', 'dict', 'set', 'tuple'], 'd', 'Types and variables', 'Tuples cannot change.'),
			tf('Python uses indentation to define blocks.', true, 'Control flow', 'Indentation is syntax.'),
			code(
				'Write `squares(n)` returning a dict mapping 1..n to squares.',
				'def squares(n):\n    return {i: i * i for i in range(1, n + 1)}',
				['def\\s+squares', 'range\\s*\\(\\s*1', 'return'],
				'Comprehensions',
				'A dict comprehension.'
			)
		]
	},
	{
		key: 'python-oop',
		title: 'Functions, classes and errors in Python',
		domain: 'Python',
		description: 'Structure larger programs: arguments, classes and dataclasses, exceptions and files.',
		difficulty: 2,
		minutes: 150,
		skills: ['oop'],
		concepts: ['Arguments and defaults', 'Classes and instances', 'Dataclasses', 'Exceptions', 'File I/O', 'Context managers'],
		prerequisites: ['python-basics'],
		practice: [
			{ title: 'Bank account', prompt: 'BankAccount whose withdraw raises a custom InsufficientFunds.' },
			{ title: 'CSV summary', prompt: 'Read a CSV in a with-block; print row count and column averages.' }
		],
		resources: { primary: 'python-classes', alternative: 'python-tutorial', practice: 'exercism-python' },
		questions: [
			mcq('`with open(...) as f:` guarantees…', ['Faster reads', 'The file closes even on error', 'Creation', 'Locking'], 'b', 'Context managers', 'Cleanup on exit.'),
			tf('`def f(items=[])` shares the same list across calls.', true, 'Arguments and defaults', 'Defaults evaluate once.'),
			short(
				'When should you catch an exception?',
				'Only when you can meaningfully handle or recover at that level; otherwise let it propagate so it is not hidden.',
				['handle|recover', 'propagat|hide|silent|swallow|bubble'],
				'Exceptions',
				'Catching everything hides bugs.'
			)
		]
	},
	{
		key: 'numpy-pandas',
		title: 'Data wrangling with NumPy and pandas',
		domain: 'Data',
		description: 'Load, clean, filter, group and join tabular data with pandas on fast NumPy arrays.',
		difficulty: 2,
		minutes: 240,
		skills: ['pandas', 'numpy', 'data analysis'],
		concepts: ['Arrays and vectorisation', 'DataFrames and Series', 'Selection and filtering', 'Missing data', 'groupby', 'Merging'],
		prerequisites: ['python-basics'],
		practice: [
			{ title: 'Clean a dataset', prompt: 'Fix types and missing values in a public CSV, justifying each decision.' },
			{ title: 'Three questions', prompt: 'Answer three questions with groupby and merge.' }
		],
		resources: { primary: 'pandas-10min', alternative: 'numpy-beginners', practice: 'kaggle-pandas' },
		questions: [
			mcq('Select rows where "age" > 30:', ['df.age > 30', 'df[df["age"] > 30]', 'df.select(age > 30)', 'df.where("age > 30")'], 'b', 'Selection and filtering', 'Boolean indexing.'),
			tf('Vectorised NumPy ops are usually much faster than loops.', true, 'Arrays and vectorisation', 'They run in C.'),
			code('Average "price" per "category" in df.', 'df.groupby("category")["price"].mean()', ['groupby', 'price', 'mean'], 'groupby', 'Split, select, aggregate.')
		]
	},
	{
		key: 'data-visualization',
		title: 'Data visualisation',
		domain: 'Data',
		description: 'Choose the right chart for the question, build clear plots and avoid misleading visuals.',
		difficulty: 2,
		minutes: 120,
		skills: ['visualization', 'matplotlib', 'seaborn'],
		concepts: ['Chart selection', 'Distributions', 'Relationships', 'Comparisons over time', 'Honest axes'],
		prerequisites: ['numpy-pandas'],
		practice: [{ title: 'One question, one chart', prompt: 'Answer three questions each with the single best chart; justify each.' }],
		resources: { primary: 'kaggle-dataviz', alternative: 'seaborn-tutorial' },
		questions: [
			mcq('Distribution of one numeric variable?', ['Pie', 'Histogram', 'Line', 'Scatter'], 'b', 'Distributions', 'Shows shape and spread.'),
			mcq('Relationship between two numeric variables?', ['Bar', 'Scatter', 'Pie', 'Histogram'], 'b', 'Relationships', 'Reveals correlation.'),
			tf('Truncating a bar chart y-axis can exaggerate differences.', true, 'Honest axes', 'Bars should start at zero.')
		]
	},
	{
		key: 'statistics',
		title: 'Statistics and probability',
		domain: 'Math',
		description: 'Summary statistics, probability, distributions, sampling, confidence and hypothesis tests.',
		difficulty: 2,
		minutes: 240,
		skills: ['statistics', 'probability'],
		concepts: ['Mean, median, variance', 'Probability', 'Distributions', 'Sampling', 'Confidence intervals', 'Hypothesis testing'],
		prerequisites: [],
		practice: [{ title: 'Simulate it', prompt: 'Simulate 10,000 two-dice rolls; compare the sum distribution to exact probabilities.' }],
		resources: { primary: 'khan-statistics', alternative: 'openintro-stats', practice: 'seeing-theory' },
		questions: [
			mcq('Most robust to outliers?', ['Mean', 'Median', 'Range', 'Std dev'], 'b', 'Mean, median, variance', 'Order, not magnitude.'),
			tf('Correlation proves causation.', false, 'Hypothesis testing', 'Confounders exist.'),
			short(
				'What does p = 0.03 mean?',
				'If the null hypothesis were true, there would be a 3% chance of data at least this extreme.',
				['null', 'extreme|at least|as large', '3%|0\\.03|probab|chance'],
				'Hypothesis testing',
				'Not the probability the null is true.'
			)
		]
	},
	{
		key: 'linear-algebra',
		title: 'Linear algebra for ML',
		domain: 'Math',
		description: 'Vectors, matrices, dot products and transformations — how models represent and transform data.',
		difficulty: 3,
		minutes: 180,
		skills: ['linear algebra'],
		concepts: ['Vectors', 'Dot product', 'Matrix multiplication', 'Linear transformations', 'Eigenvectors'],
		prerequisites: [],
		practice: [{ title: 'By hand, then NumPy', prompt: 'Multiply two 2×2 matrices by hand, verify in NumPy, describe the geometry.' }],
		resources: { primary: '3b1b-linear-algebra', alternative: 'mit-1806', practice: 'numpy-beginners' },
		questions: [
			mcq('Dot product of perpendicular vectors?', ['1', '0', '-1', 'Product of lengths'], 'b', 'Dot product', 'cos 90° = 0.'),
			mcq('(2×3) × (3×4) shape?', ['3×3', '2×4', '4×2', 'Undefined'], 'b', 'Matrix multiplication', 'Outer dimensions.'),
			tf('Matrix multiplication is commutative.', false, 'Matrix multiplication', 'Order matters.')
		]
	},
	{
		key: 'ml-foundations',
		title: 'Machine learning foundations',
		domain: 'Machine Learning',
		description: 'Supervised learning end to end: features, splits, regression, classification, overfitting and scikit-learn.',
		difficulty: 3,
		minutes: 240,
		skills: ['machine learning', 'ml', 'scikit-learn'],
		concepts: ['Features and labels', 'Train/test split', 'Regression', 'Classification', 'Overfitting', 'Pipelines'],
		prerequisites: ['numpy-pandas', 'statistics'],
		practice: [{ title: 'First model', prompt: 'Train a decision tree, evaluate on held-out data, tune max_depth, explain.' }],
		resources: { primary: 'google-ml-crash-course', alternative: 'sklearn-getting-started', practice: 'kaggle-intro-ml' },
		questions: [
			mcq('99% train, 60% test is…', ['Underfitting', 'Overfitting', 'Leakage', 'Generalisation'], 'b', 'Overfitting', 'It memorised training data.'),
			mcq('Predicting house prices is…', ['Classification', 'Regression', 'Clustering', 'RL'], 'b', 'Regression', 'Continuous target.'),
			tf('Tune hyperparameters on the test set.', false, 'Train/test split', 'Use validation data.')
		]
	},
	{
		key: 'model-evaluation',
		title: 'Evaluating models',
		domain: 'Machine Learning',
		description: 'Pick metrics that fit the problem, cross-validate, read confusion matrices and spot leakage.',
		difficulty: 3,
		minutes: 150,
		skills: ['model evaluation'],
		concepts: ['Accuracy vs precision/recall', 'Confusion matrix', 'Cross-validation', 'Data leakage', 'Baselines'],
		prerequisites: ['ml-foundations'],
		practice: [{ title: 'Imbalanced data', prompt: 'With 5% positives, compare metrics of your model vs "always negative".' }],
		resources: { primary: 'sklearn-model-evaluation', alternative: 'sklearn-cross-validation', practice: 'kaggle-intermediate-ml' },
		questions: [
			mcq('Fraud detection where missing fraud is costly — prioritise…', ['Accuracy', 'Recall', 'Speed', 'R²'], 'b', 'Accuracy vs precision/recall', 'Catch positives.'),
			tf('Scaling on the full dataset before splitting can leak information.', true, 'Data leakage', 'Fit on training data only.'),
			short(
				'Why compare against a simple baseline?',
				'It shows whether the model adds value beyond a trivial strategy like predicting the majority class.',
				['trivial|simple|majority|mean|naive|dumb', 'value|better|improv|beat'],
				'Baselines',
				'Impressive numbers can be worthless.'
			)
		]
	},
	{
		key: 'neural-networks',
		title: 'Neural networks and deep learning',
		domain: 'Deep Learning',
		description: 'Layers, activations, loss, gradient descent and backprop — then training models in PyTorch.',
		difficulty: 4,
		minutes: 300,
		skills: ['deep learning', 'neural networks', 'pytorch'],
		concepts: ['Neurons and layers', 'Activation functions', 'Loss functions', 'Gradient descent', 'Backpropagation', 'Training loop'],
		prerequisites: ['ml-foundations', 'linear-algebra'],
		practice: [{ title: 'MNIST', prompt: 'Train a small network on MNIST in PyTorch; plot train vs validation loss.' }],
		resources: { primary: '3b1b-neural-networks', alternative: 'fastai-course', practice: 'pytorch-tutorials', project: 'karpathy-zero-to-hero' },
		questions: [
			mcq('Backpropagation computes…', ['Predictions', 'Loss gradients for each weight', 'Learning rate', 'Data'], 'b', 'Backpropagation', 'Chain rule.'),
			tf('Without non-linear activations, a deep net equals one linear layer.', true, 'Activation functions', 'Linear maps compose.'),
			short(
				'What if the learning rate is too high?',
				'Updates overshoot the minimum so loss oscillates or diverges.',
				['overshoot|jump|too big|skip', 'diverge|oscillat|unstable|explode|bounce'],
				'Gradient descent',
				'Too low is slow; too high is unstable.'
			)
		]
	},
	{
		key: 'llms-transformers',
		title: 'Transformers and large language models',
		domain: 'Deep Learning',
		description: 'Tokens, embeddings and attention; how transformers generate text; strengths and limits of LLMs.',
		difficulty: 4,
		minutes: 180,
		skills: ['llm', 'transformers', 'nlp'],
		concepts: ['Tokenisation', 'Embeddings', 'Self-attention', 'Next-token prediction', 'Context window', 'Hallucination'],
		prerequisites: ['neural-networks'],
		practice: [{ title: 'Explain attention', prompt: 'Explain self-attention with a worked 4-word example.' }],
		resources: { primary: 'illustrated-transformer', alternative: 'hf-llm-course', project: 'karpathy-zero-to-hero' },
		questions: [
			mcq('Self-attention lets a token…', ['Ignore others', 'Weigh information from other tokens', 'Delete words', 'Translate'], 'b', 'Self-attention', 'Context-aware representations.'),
			tf('LLMs can state false information confidently.', true, 'Hallucination', 'They predict plausible text.'),
			short(
				'What is an embedding?',
				'A dense numeric vector representing text so similar meanings are close in vector space.',
				['vector|numer|number', 'similar|meaning|close|distance'],
				'Embeddings',
				'Powers semantic search.'
			)
		]
	},
	{
		key: 'llm-apps',
		title: 'Building LLM applications',
		domain: 'AI Engineering',
		description: 'Prompt design, structured output, retrieval with embeddings, tool calling, evaluation and failure handling.',
		difficulty: 4,
		minutes: 240,
		skills: ['ai engineering', 'rag', 'prompting', 'llm apps'],
		concepts: ['Prompt design', 'Structured output', 'Retrieval (RAG)', 'Vector search', 'Tool calling', 'Evaluation', 'Failure handling'],
		prerequisites: ['llms-transformers'],
		practice: [
			{ title: 'RAG over notes', prompt: 'Embed notes into Postgres with pgvector and answer questions with citations.' },
			{ title: 'Eval set', prompt: 'Write 15 test cases; score two prompt versions.' }
		],
		resources: { primary: 'ai-sdk-docs', alternative: 'prompting-guide', practice: 'pgvector' },
		questions: [
			mcq('RAG mainly addresses…', ['Slow inference', 'Answering from private or fresh knowledge', 'Images', 'Tokenisation'], 'b', 'Retrieval (RAG)', 'Inject documents at query time.'),
			tf('AI features should degrade gracefully when the model API fails.', true, 'Failure handling', 'Keep the product usable.'),
			short(
				'Why request schema-validated LLM output?',
				'So code can parse and validate responses reliably instead of fragile free-text parsing.',
				['pars|valid', 'reliab|consisten|schema|json|typed'],
				'Structured output',
				'Schemas give typed data.'
			)
		]
	}
];
