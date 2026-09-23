import type { CatalogTopic } from '../types';
import { code, mcq, short, tf } from './helpers';

export const CS_TOPICS: CatalogTopic[] = [
	{
		key: 'programming-logic',
		title: 'Programming and problem solving',
		domain: 'CS Foundations',
		description: 'Break problems into steps, trace code by hand and reason about correctness.',
		difficulty: 1,
		minutes: 180,
		skills: ['programming', 'problem solving'],
		concepts: ['Decomposition', 'Tracing code', 'Loops and conditions', 'Functions as abstractions', 'Debugging'],
		prerequisites: [],
		practice: [
			{ title: 'Trace by hand', prompt: 'Trace a nested loop on paper, then verify by running it.' },
			{ title: 'Decompose', prompt: 'Break "tip calculator" into five functions before coding.' }
		],
		resources: { primary: 'cs50x', alternative: 'freecodecamp' },
		questions: [
			mcq('First step when output is wrong?', ['Rewrite', 'Reproduce and narrow where values diverge', 'Add features', 'Ask immediately'], 'b', 'Debugging', 'Reproduce, isolate, fix, verify.'),
			tf('Functions name logic so it can be reused.', true, 'Functions as abstractions', 'Abstraction.'),
			code('How many times does the loop body run?', '3', ['^\\s*3\\s*$|three'], 'Tracing code', 'i = 2, 5, 8.', 'for i in range(2, 10, 3):\n    print(i)')
		]
	},
	{
		key: 'data-structures',
		title: 'Core data structures',
		domain: 'CS Foundations',
		description: 'Arrays, linked lists, stacks, queues, hash tables, trees and graphs — how they work and when to choose each.',
		difficulty: 3,
		minutes: 300,
		skills: ['data structures', 'dsa'],
		concepts: ['Arrays vs linked lists', 'Stacks and queues', 'Hash tables', 'Trees and BSTs', 'Heaps', 'Graphs'],
		prerequisites: ['programming-logic'],
		practice: [
			{ title: 'Stack and queue', prompt: 'Implement both with O(1) operations and tests.' },
			{ title: 'Balanced brackets', prompt: 'Check "{[()]}"-style strings with a stack.' }
		],
		resources: { primary: 'visualgo', alternative: 'open-data-structures', practice: 'neetcode-roadmap' },
		questions: [
			mcq('Average hash table lookup?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 'a', 'Hash tables', 'Direct bucket access.'),
			mcq('Last-in, first-out structure?', ['Queue', 'Stack', 'Heap', 'Map'], 'b', 'Stacks and queues', 'Same end push/pop.'),
			tf('In-order traversal of a BST is sorted.', true, 'Trees and BSTs', 'Left < node < right.')
		]
	},
	{
		key: 'algorithms-complexity',
		title: 'Algorithms and complexity',
		domain: 'CS Foundations',
		description: 'Big-O analysis, searching, sorting, recursion, BFS/DFS and dynamic programming.',
		difficulty: 4,
		minutes: 360,
		skills: ['algorithms', 'leetcode'],
		concepts: ['Big-O notation', 'Binary search', 'Sorting', 'Recursion', 'BFS and DFS', 'Dynamic programming'],
		prerequisites: ['data-structures'],
		practice: [
			{ title: 'Binary search', prompt: 'Iterative and recursive, tested on empty, single and missing cases.' },
			{ title: 'Patterns', prompt: 'Solve three "Two Pointers" problems; describe the pattern.' }
		],
		resources: { primary: 'mit-6006', alternative: 'bigo-cheatsheet', practice: 'neetcode-roadmap' },
		questions: [
			mcq('Binary search requires input to be…', ['Unique', 'Sorted', 'A list', 'Small'], 'b', 'Binary search', 'Discard half each step.'),
			mcq('Two nested loops over n?', ['O(n)', 'O(2n)', 'O(n²)', 'O(log n)'], 'c', 'Big-O notation', 'n × n.'),
			short(
				'When does dynamic programming fit?',
				'Overlapping subproblems and optimal substructure, so sub-results can be stored and reused.',
				['overlap', 'substructure|subproblem', 'store|memo|reuse|cache|table'],
				'Dynamic programming',
				'Memoisation avoids recomputation.'
			)
		]
	},
	{
		key: 'operating-systems',
		title: 'Operating systems essentials',
		domain: 'Systems',
		description: 'Processes and threads, memory, scheduling, concurrency and file systems.',
		difficulty: 4,
		minutes: 300,
		skills: ['operating systems', 'os'],
		concepts: ['Processes and threads', 'Virtual memory', 'Scheduling', 'Concurrency and locks', 'File systems'],
		prerequisites: ['programming-logic'],
		practice: [{ title: 'Race condition', prompt: 'Two threads increment a counter without a lock; observe, then fix.' }],
		resources: { primary: 'ostep', alternative: 'missing-semester' },
		questions: [
			mcq('Threads in a process share…', ['Nothing', 'The address space', 'Separate heaps', 'Separate files'], 'b', 'Processes and threads', 'Hence synchronisation.'),
			tf('Race conditions depend on unpredictable timing.', true, 'Concurrency and locks', 'Locks enforce order.'),
			short(
				'What does virtual memory give each process?',
				'Its own private address space mapped onto physical memory, providing isolation.',
				['own|private|isolat', 'address space|map'],
				'Virtual memory',
				'Processes can’t read each other.'
			)
		]
	},
	{
		key: 'networking',
		title: 'Computer networking',
		domain: 'Systems',
		description: 'IP, TCP vs UDP, ports, sockets, DNS and TLS — and how they combine into HTTP.',
		difficulty: 3,
		minutes: 240,
		skills: ['networking', 'tcp/ip'],
		concepts: ['IP addresses', 'TCP vs UDP', 'Ports and sockets', 'DNS', 'TLS handshake'],
		prerequisites: ['how-the-web-works'],
		practice: [{ title: 'Echo server', prompt: 'TCP echo server and client; explain what changes with UDP.' }],
		resources: { primary: 'beej-networking', alternative: 'cloudflare-learning' },
		questions: [
			mcq('Ordered, reliable delivery?', ['UDP', 'TCP', 'IP', 'ICMP'], 'b', 'TCP vs UDP', 'TCP retransmits.'),
			tf('A port identifies a service on a host.', true, 'Ports and sockets', 'IP → machine, port → process.'),
			short(
				'Why might video calls use UDP?',
				'Low latency matters more than perfect delivery; retransmitting late packets is useless in real time.',
				['latency|real.?time|fast|delay', 'retransmi|late|lost|drop|old'],
				'TCP vs UDP',
				'Stale data is worse than missing data.'
			)
		]
	}
];
