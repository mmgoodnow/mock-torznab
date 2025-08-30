import Fastify, {
	type FastifyInstance,
	type FastifyRequest,
	type FastifyReply,
} from "fastify";
import { XMLBuilder } from "fast-xml-parser";

const server: FastifyInstance = Fastify({ logger: true });

const builder = new XMLBuilder({
	ignoreAttributes: false,
	format: true,
	attributeNamePrefix: "@_",
});

// Clean POJO interface
interface Torrent {
	title: string;
	guid: string;
	link: string;
	comments: string;
	pubDate: string;
	size: number;
	description: string;
	category: string[];
	attributes: Record<string, unknown>;
}

// Function to generate mock data as clean POJOs
function getMockTorrents(query: string): Torrent[] {
	const torrents: Torrent[] = [];
	const qualities = ["720p", "1080p", "2160p"];
	const sources = ["WEB-DL", "BluRay", "HDTV"];
	const groups = ["GROUPA", "GROUPB", "GROUPC"];

	for (let i = 1; i <= 10; i++) {
		const quality = qualities[Math.floor(Math.random() * qualities.length)];
		const source = sources[Math.floor(Math.random() * sources.length)];
		const group = groups[Math.floor(Math.random() * groups.length)];
		const showName = query.replace(/ /g, ".");
		const season = `S${String(Math.floor(Math.random() * 5) + 1).padStart(2, "0")}`;
		const episode = `E${String(i).padStart(2, "0")}`;

		const title = `${showName}.${season}${episode}.${quality}.${source}.H.264-${group}`;

		torrents.push({
			title,
			guid: `https://example.com/torrent/${i}`,
			link: `https://example.com/download/${i}.torrent`,
			comments: `https://example.com/torrent/${i}`,
			pubDate: new Date().toUTCString(),
			size: Math.floor(Math.random() * 1000000000) + 1000000,
			description: "A mock torrent description",
			category: ["5000", "5040"],
			attributes: {
				seeders: Math.floor(Math.random() * 100),
				peers: Math.floor(Math.random() * 100),
				infohash: "d41d8cd98f00b204e9800998ecf8427e",
				category: "5040",
				imdb: "tt1234567",
				files: i,
				grabs: i * 10,
				minimumratio: 1,
				minimumseedtime: 172800,
				downloadvolumefactor: 0,
				uploadvolumefactor: 1,
			},
		});
	}
	return torrents;
}

// Function to transform clean POJOs to the format expected by fast-xml-parser
function toXmlSerializable(torrent: Torrent) {
	return {
		title: torrent.title,
		guid: torrent.guid,
		link: torrent.link,
		comments: torrent.comments,
		pubDate: torrent.pubDate,
		size: torrent.size,
		description: torrent.description,
		category: torrent.category,
		enclosure: {
			"@_url": torrent.link,
			"@_length": torrent.size,
			"@_type": "application/x-bittorrent",
		},
		"torznab:attr": Object.entries(torrent.attributes).map(([name, value]) => ({
			"@_name": name,
			"@_value": value,
		})),
        indexer: {
            "#text": "mock-torznab",
        }
	};
}

server.get(
	"/api",
	async (
		request: FastifyRequest<{ Querystring: { t: string; q?: string, apikey?: string } }>,
		reply: FastifyReply,
	) => {
		const { t, q } = request.query;

		if (t === "caps") {
			const caps = {
				"?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
				caps: {
					server: {
						"@_version": "1.0",
						"@_title": "Mock Torznab",
						"@_strapline": "A mock Torznab server",
						"@_email": "test@test.com",
						"@_url": "http://localhost:3000",
					},
					limits: { "@_max": "100", "@_default": "50" },
					searching: {
						search: { "@_available": "yes", "@_supportedParams": "q" },
						"tv-search": {
							"@_available": "yes",
							"@_supportedParams": "q,season,ep",
						},
						"movie-search": { "@_available": "yes", "@_supportedParams": "q" },
					},
                    categories: {
                        category: [
                            { "@_id": "5000", "@_name": "TV" },
                            { "@_id": "5040", "@_name": "TV/HD" },
                        ]
                    },
                    tags: {
                        tag: [
                            { "@_name": "internal", "@_description": "Uploader is an internal release group" },
                            { "@_name": "freeleech", "@_description": "Download doesn't count toward ratio" },
                        ]
                    }
				},
			};
			reply.header("Content-Type", "application/xml");
			return builder.build(caps);
		}

		if (t === "search" || t === "tvsearch" || t === "movie") {
			const torrents = getMockTorrents(q || "test");
			const xmlTorrents = torrents.map(toXmlSerializable);
			const feed = {
				"?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
				rss: {
					"@_version": "1.0",
					"@_xmlns:atom": "http://www.w3.org/2005/Atom",
					"@_xmlns:torznab": "http://torznab.com/schemas/2015/feed",
					channel: {
						"atom:link": {
							"@_href": "http://localhost:3000/api?t=search&q=test",
							"@_rel": "self",
							"@_type": "application/rss+xml",
						},
						title: "Mock Torznab",
						link: "http://localhost:3000",
						description: "Mock Torznab feed",
						item: xmlTorrents,
					},
				},
			};
			reply.header("Content-Type", "application/xml");
			return builder.build(feed);
		}

		reply.code(404).send({ error: "Not found" });
	},
);

const start = async () => {
	try {
		await server.listen({ port: 3000, host: '0.0.0.0' });
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

start();
