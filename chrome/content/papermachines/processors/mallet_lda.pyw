#!/usr/bin/env python
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
import mallet

class MalletLDA(mallet.Mallet):
	"""
	Perform LDA using MALLET
	"""

	def _basic_params(self):
		self.categorical = False
		self.template_name = "mallet_lda"
		self.name = "mallet_lda"
		self.topics = 50
		self.dry_run = False
		self.dfr = len(self.extra_args) > 0
		if self.dfr:
			self.dfr_dir = self.extra_args[0]

	def _stdev(self, X):
		n = float(len(X))
		xbar = float(sum(X)) / n
		variances = [math.pow(float(x) - xbar, 2.0) for x in X]
		return math.sqrt((1.0 / (n - 1.0)) * sum(variances))

	def _cov(self, X, Y):
		n = float(len(X))
		xbar = sum(X) / n
		ybar = sum(Y) / n
		return (1.0/(n-1.0)) * sum([((x-xbar) * (y-ybar)) for x, y in zip(X, Y)])

	def _find_proportions(self, topics):
		self.proportions = {}
		for i in range(len(topics)):
			self.proportions[i] = float(sum(topics[i])) / len(topics[i])

	def _find_stdevs(self, topics):
		self.stdevs = {}
		for i in range(len(topics)):
			self.stdevs[i] = self._stdev(topics[i])

	def _find_correlations(self, topics):
		self.correlations = {}
		for i in range(len(topics)):
			for j in range(i+1,len(topics)):
				self.correlations[str(i) + ',' + str(j)] = self._cov(topics[i], topics[j]) / (self.stdevs[i] * self.stdevs[j])
	
	def _sort_into_intervals(self):
		years = set()
		fname_to_year = {}

		fnames = self.metadata.keys()
		for filename in fnames:
			x = self.metadata[filename]
			if x['year'].isdigit() and x['year'] != '0000':
				year = int(x['year'])
			else:
				year = 2012
			years.add(year)
			fname_to_year[filename] = year

		years = sorted(years)
		self.intervals = years
		self.fname_to_interval = fname_to_year
		self.fname_to_index = {fname: years.index(year) for fname, year in fname_to_year.iteritems()}

	def process(self):
		"""
		run LDA, creating an output file divided by time
		"""

		if self.named_args is not None:
			self.tfidf = self.named_args["tfidf"]
			self.min_df = int(self.named_args["min_df"])
			self.stemming = self.named_args["stemming"]
			self.topics = int(self.named_args["topics"])
			self.iterations = int(self.named_args["iterations"])
			self.alpha = self.named_args["alpha"]
			self.beta = self.named_args["beta"]
			self.symmetric_alpha = str(self.named_args["symmetric_alpha"]).lower()
			self.optimize_interval = self.named_args["optimize_interval"]
			self.burn_in = int(self.named_args["burn_in"])
		else:
			self.tfidf = True
			self.min_df = 5
			self.topics = 50
			self.stemming = True
			self.iterations = 1000
			self.alpha = "50.0"
			self.beta = "0.01"
			self.burn_in = 200
			self.symmetric_alpha = "true"
			self.optimize_interval = 0


		self._setup_mallet_instances(sequence=True, tfidf=self.tfidf, stemming=self.stemming)

		self.mallet_files = {'state': os.path.join(self.mallet_out_dir, "topic-state.gz"),
			'doc-topics': os.path.join(self.mallet_out_dir, "doc-topics.txt"),
			'topic-keys': os.path.join(self.mallet_out_dir, "topic-keys.txt"),
			'word-topics': os.path.join(self.mallet_out_dir, "word-topics.txt"),
			'diagnostics-file': os.path.join(self.mallet_out_dir, "diagnostics-file.txt")}
		process_args = self.mallet + ["cc.mallet.topics.tui.TopicTrainer",
			"--input", self.instance_file,
			"--num-topics", str(self.topics),
			"--num-iterations", str(self.iterations),
			"--optimize-interval", str(self.optimize_interval),
			"--optimize-burn-in", str(self.burn_in),
			"--use-symmetric-alpha", self.symmetric_alpha,
			"--alpha", self.alpha,
			"--beta", self.beta,
			"--output-state", self.mallet_files['state'],
			"--output-doc-topics", self.mallet_files['doc-topics'],
			"--output-topic-keys", self.mallet_files['topic-keys'],
			"--diagnostics-file", self.mallet_files['diagnostics-file'],
			"--word-topic-counts-file", self.mallet_files['word-topics']]

		logging.info("begin LDA")

		start_time = time.time()
		if not self.dry_run:
			lda_return = subprocess.call(process_args, stdout=self.progress_file, stderr=self.progress_file)

		logging.info("LDA complete in " + str(time.time() - start_time) + " seconds")

		coherence = {}
		wordProbs = {}
		allocationRatios = {}
		with file(self.mallet_files['diagnostics-file']) as diagnostics:
			tree = et.parse(diagnostics)
			for elem in tree.iter("topic"):
				topic = elem.get("id")
				coherence[topic] = float(elem.get("coherence"))
				allocationRatios[topic] = float(elem.get("allocation_ratio"))
				wordProbs[topic] = []
				for word in elem.iter("word"):
					wordProbs[topic].append({'text': word.text, 'prob': word.get("prob")})

		labels = {x[0]: {"label": x[2:5], "fulltopic": wordProbs[x[0]], "allocation_ratio": allocationRatios[x[0]]} for x in [y.split() for y in file(self.mallet_files['topic-keys']).readlines()]}

		weights_by_topic = []
		doc_metadata = {}

		self._sort_into_intervals()

		for i in range(self.topics):
			weights_by_topic.append([{'x': str(j), 'y': [], 'topic': i} for j in self.intervals])		

		for line in file(self.mallet_files['doc-topics']):
			try:
				values = line.split('\t')
				
				id = values.pop(0)
				if id.startswith("#doc"):
					continue
				filename = self.docs[int(id)]
				del values[0]

				itemid = self.metadata[filename]["itemID"]

				doc_metadata[itemid] = {"label": self.metadata[filename]["label"], "title": self.metadata[filename]["title"]}

				freqs = {int(y[0]): float(y[1]) for y in self.xpartition(values)}
				main_topic = None
				topic_max = 0.0
				for i in freqs.keys():
					weights_by_topic[i][self.fname_to_index[filename]]['y'].append({"itemID": itemid, "ratio": freqs[i]})
					if freqs[i] > topic_max:
						main_topic = i
						topic_max = freqs[i]
				doc_metadata[itemid]["main_topic"] = main_topic
			except KeyboardInterrupt:
				sys.exit(1)
			except:
				logging.error(traceback.format_exc())

		topics_by_year = []
		for topic in weights_by_topic:
			topic_sums = []	
			for year in topic:
				sum = 0.0
				if len(year['y']) != 0:
					for doc in year['y']:
						sum += doc['ratio']
					topic_sums.append(sum / float(len(year['y'])))
				else:
					topic_sums.append(0)
			topics_by_year.append(topic_sums)

		self.topics_by_year = topics_by_year
		self._find_proportions(topics_by_year)
		try:		
			self._find_stdevs(topics_by_year)
			self._find_correlations(topics_by_year)
		except:
			self.stdevs = {}
			self.correlations = {}

		self.template_filename = os.path.join(self.cwd, "templates", self.template_name + ".html")

		params = {"CATEGORICAL": "true" if self.categorical else "false",
				"TOPICS_DOCS": json.dumps(weights_by_topic, separators=(',',':')),
				"DOC_METADATA": json.dumps(doc_metadata, separators=(',',':')),
				"TOPIC_LABELS": json.dumps(labels, separators=(',',':')),
				"TOPIC_COHERENCE": json.dumps(coherence, separators=(',',':')),
				"TOPIC_PROPORTIONS": json.dumps(self.proportions, separators=(',',':')),
				"TOPIC_STDEVS": json.dumps(self.stdevs, separators=(',',':')),
				"TOPIC_CORRELATIONS": json.dumps(self.correlations, separators=(',',':'))
		}

		index = getattr(self, "index", "{}")
		params["###INDEX###"] = json.dumps(index, separators=(',',':'))

		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletLDA(track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())