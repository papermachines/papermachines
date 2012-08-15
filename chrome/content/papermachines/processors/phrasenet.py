#!/usr/bin/env python
import sys, os, json, re, tempfile, cStringIO, logging, traceback
import textprocessor

class PhraseNet(textprocessor.TextProcessor):
	"""
	Generate phrase net
	cf. http://www-958.ibm.com/software/data/cognos/manyeyes/page/Phrase_Net.html
	"""
	def _findPhrases(self, pattern):
		self.nodes = {}
		self.edges = {}
		for filename in self.files:
			with file(filename) as f:
				logging.info("processing " + filename)
				for re_match in pattern.finditer(f.read()):
					match = re_match.groups()
					if any([word in self.stopwords for word in match]):
						continue

					match = [w.lower() for w in match]

					for word in match:
						if not word in self.nodes:
							self.nodes[word] = 1
						else:
							self.nodes[word] += 1

					edge = match[0] + self.edgesep + match[1]
					if not edge in self.edges:
						self.edges[edge] = 1
					else:
						self.edges[edge] += 1
					
	def process(self):
		logging.info("starting to process")
		self.name = "phrasenet"

		stopfile = os.path.join(self.cwd, "stopwords.txt")
		logging.info("reading stopwords from " + stopfile)
		self.stopwords = [line.strip() for line in file(stopfile)]

		self.edgesep = ','

		wordregex = "(\w+)"
		# self.patterns = {
		# 	"x and y": wordregex + " and " + wordregex,
		# 	"x or y": wordregex + " or " + wordregex,
		# 	"x's y": wordregex +"'s " + wordregex,
		# 	"x of the y": wordregex + " of the " + wordregex,
		# 	"x the y": wordregex + " the " + wordregex,
		# 	"x a y": wordregex + " a " + wordregex,
		# 	"x at y": wordregex + " at " + wordregex,
		# 	"x is y": wordregex + " is " + wordregex,
		# 	"x [space] y": wordregex + " " + wordregex
		# }

		if len(self.extra_args) > 0:
			pattern_str = self.extra_args[0]
		else:
			pattern_str = "x and y"

		if "x" in pattern_str and "y" in pattern_str:
			pattern = pattern_str.replace('x', wordregex)
			pattern = pattern.replace('y', wordregex)

		logging.info("extracting phrases according to pattern "+ repr(pattern))

		self._findPhrases(re.compile(pattern))

		logging.info("generating JSON")

		# top_nodes = self.nodes.keys()
		# top_nodes.sort(key=lambda x: self.nodes[x])
		# # top_nodes = top_nodes[:50]

		# nodeindex = dict(zip(top_nodes, range(len(top_nodes))))

		used_nodes = set()

		jsondata = {'nodes': [], 'edges': []}

		top_edges = self.edges.keys()
		top_edges.sort(key=lambda x: self.edges[x])
		top_edges.reverse()
		top_edges = top_edges[:50]

		# for edge, weight in self.edges.iteritems():
		for edge in top_edges:
			words = edge.split(',')
			used_nodes.update(words)

		nodeindex = dict(zip(used_nodes, range(len(used_nodes))))

		for edge in top_edges:
			weight = self.edges[edge]
			words = edge.split(',')
			jsondata['edges'].append({'source': nodeindex[words[0]], 'target': nodeindex[words[1]], 'weight': weight})

		for node in used_nodes:
			jsondata['nodes'].append({'index': nodeindex[node], 'name': node, 'freq': self.nodes[node]})

		params = {"DATA": json.dumps(jsondata), "PATTERN": pattern_str}
		self.write_html(params)

if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "phrasenet.log"), level=logging.INFO)
		processor = PhraseNet(sys.argv, track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())