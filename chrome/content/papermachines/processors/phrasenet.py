#!/usr/bin/env python2.7
import sys, os, json, re, tempfile, cStringIO, logging, traceback, codecs
import textprocessor

class PhraseNet(textprocessor.TextProcessor):
	"""
	Generate phrase net
	cf. http://www-958.ibm.com/software/data/cognos/manyeyes/page/Phrase_Net.html
	"""

	def _basic_params(self):
		self.name = "phrasenet"

	def _findPhrases(self, pattern):
		self.nodes = {}
		self.edges = {}
		for filename in self.files:
			self.update_progress()
			with codecs.open(filename, 'r', encoding='utf8') as f:
				logging.info("processing " + filename)
				for re_match in pattern.finditer(f.read()):
					match = [w.lower() for w in re_match.groups()]
					if any([word in self.stopwords for word in match]):
						continue

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

		stopfile = os.path.join(self.cwd, "stopwords.txt")
		logging.info("reading stopwords from " + stopfile)
		self.stopwords = [line.strip() for line in file(stopfile)]

		self.edgesep = ','

		wordregex = "(\w+)"

		if len(self.extra_args) > 0:
			pattern_str = self.extra_args[0]
		else:
			pattern_str = "x and y"

		if pattern_str.count('x') == 1 and pattern_str.count('y') == 1:
			pattern = pattern_str.replace('x', wordregex)
			pattern = pattern.replace('y', wordregex)
		else:
			pattern = pattern_str

		logging.info("extracting phrases according to pattern "+ repr(pattern))

		self._findPhrases(re.compile(pattern))

		logging.info("generating JSON")

		used_nodes = set()

		jsondata = {'nodes': [], 'edges': []}

		top_edges = self.edges.keys()
		top_edges.sort(key=lambda x: self.edges[x])
		top_edges.reverse()
		top_edges = top_edges[:50]

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

		params = {"DATA": json.dumps(jsondata), "PATTERN": json.dumps(pattern_str)}
		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = PhraseNet(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())