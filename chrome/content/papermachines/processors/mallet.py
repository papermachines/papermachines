#!/usr/bin/env python
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, traceback
import xml.etree.ElementTree as et
from itertools import izip
import textprocessor

class MalletLDA(textprocessor.TextProcessor):
	"""
	Perform LDA using MALLET
	"""

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

	# def _cor(self, X, Y):
	# 	return self._cov(X, Y)/(self._stdev(X) * self._stdev(Y))

	def _find_proportions(self, topics, total_docs):
		self.proportions = {}
		for i in range(len(topics)):
			self.proportions[i] = float(sum(topics[i])) / total_docs

	def _find_stdevs(self, topics):
		self.stdevs = {}
		for i in range(len(topics)):
			self.stdevs[i] = self._stdev(topics[i])

	def _find_correlations(self, topics):
		self.correlations = {}
		for i in range(len(topics)):
			for j in range(i+1,len(topics)):
				self.correlations[str(i) + ',' + str(j)] = self._cov(topics[i], topics[j]) / (self.stdevs[i] * self.stdevs[j])

	def _import_files(self):
		with file(self.texts_file, 'w') as f:
			for filename in self.files:
				with file(filename) as input_file:
					text = input_file.read()
					text = re.sub("""[^\w,.'" ]+""", '', text.replace("\n", " "))
					# f.write('\t'.join([filename.replace(" ","_"), self.collection, text]) + '\n')
					f.write('\t'.join([filename.replace(" ","_"), self.collection, text]) + '\n')

	def process(self):
		"""
		run LDA, creating an output file divided by time and one by place
		"""
		self.name = "mallet"
		self.lda_out_dir = os.path.join(self.out_dir, self.name + self.collection)
		self.dry_run = False

		if not os.path.exists(self.lda_out_dir):
			os.makedirs(self.lda_out_dir)

		self.stoplist = os.path.join(self.cwd, "stopwords.txt")
		self.stopwords = file(self.stoplist).read()

		self.instance_file = os.path.join(self.lda_out_dir, self.collection + ".mallet")
		self.mallet_cp_dir = os.path.join(self.cwd, "lib", "mallet-2.0.7", "dist")

		self.mallet_classpath = os.path.join(self.mallet_cp_dir, "mallet.jar") + ":" + os.path.join(self.mallet_cp_dir, "mallet-deps.jar")

		self.mallet = "java -Xmx1g -ea -Djava.awt.headless=true -Dfile.encoding=UTF-8 -server".split(' ')
		self.mallet += ["-classpath", self.mallet_classpath]

		self.progress_filename = os.path.join(self.out_dir, self.name + self.collection + "progress.txt")

		self.progress_file = file(self.progress_filename, 'w')

		self.topics = 50

		logging.info("copying texts into single file")

		self.texts_file = os.path.join(self.lda_out_dir, self.collection + ".txt")

		if not self.dry_run:
			self._import_files()

		# import_args = self.mallet + ["cc.mallet.classify.tui.Csv2Vectors", 
		import_args = self.mallet + ["cc.mallet.util.BulkLoader", 
			"--keep-sequence",
			"--remove-stopwords",
			"--stoplist", self.stoplist, 
			"--input", self.texts_file,
			"--prune-count", "3",
			"--prune-doc-frequency", "0.9",
			"--output", self.instance_file]

		logging.info("beginning text import")
		if not self.dry_run:
			import_return = subprocess.call(import_args, stdout=self.progress_file)

		self.mallet_files = {'state': os.path.join(self.lda_out_dir, "topic-state.gz"),
			'doc-topics': os.path.join(self.lda_out_dir, "doc-topics.txt"),
			'topic-keys': os.path.join(self.lda_out_dir, "topic-keys.txt"),
			'word-topics': os.path.join(self.lda_out_dir, "word-topics.txt"),
			'diagnostics-file': os.path.join(self.lda_out_dir, "diagnostics-file.txt")}
		process_args = self.mallet + ["cc.mallet.topics.tui.TopicTrainer",
			"--input", self.instance_file,
			"--num-topics", str(self.topics),
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
		with file(self.mallet_files['diagnostics-file']) as diagnostics:
			tree = et.parse(diagnostics)
			for elem in tree.iter("topic"):
				topic = elem.get("id")
				coherence[topic] = float(elem.get("coherence"))
				wordProbs[topic] = []
				for word in elem.iter("word"):
					wordProbs[topic].append({'text': word.text, 'prob': word.get("prob")})

		xpartition = lambda seq, n=2: izip(*(iter(seq),) * n)


		labels = {x[0]: {"label": x[2:5], "fulltopic": wordProbs[x[0]]} for x in [y.split() for y in file(self.mallet_files['topic-keys']).readlines()]} 

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
			cleaned_filename = filename.replace(" ", "_")
			fname_to_year[cleaned_filename] = year
			self.metadata[cleaned_filename] = x

		years = sorted(years)
		fname_to_index = {fname: years.index(year) for fname, year in fname_to_year.iteritems()}

		weights_by_topic = []

		for i in range(self.topics):
			weights_by_topic.append([{'x': str(j), 'y': [], 'topic': i} for j in years])		

		for line in file(self.mallet_files['doc-topics']).readlines():
			try:
				values = line.split()
				del values[0] # get rid of ID
				
				filename = values.pop(0)
				if filename == "name":
					continue
				
				freqs = {int(y[0]): float(y[1]) for y in xpartition(values)}
				for i in freqs.keys():
					weights_by_topic[i][fname_to_index[filename]]['y'].append({"title": os.path.basename(filename).replace(".txt",'').replace('_', ' '), "itemID": self.metadata[filename]["itemID"],"ratio": freqs[i]})
			except KeyboardInterrupt:
				sys.exit(1)
			except:
				logging.error(traceback.format_exc())

		topics_by_year = []
		for topic in weights_by_topic:
			topic_sums = []			
			for year in topic:
				sum = 0.0
				for doc in year['y']:
					sum += doc['ratio']
				topic_sums.append(sum)
			topics_by_year.append(topic_sums)

		self.topics_by_year = topics_by_year
		self._find_proportions(topics_by_year, len(fnames))
		self._find_stdevs(topics_by_year)
		self._find_correlations(topics_by_year)

		logging.info("writing HTML")
		try:
			with file(os.path.join(self.out_dir, self.name + self.collection + ".html"), 'w') as outfile:
				with file(os.path.join(self.cwd, "templates", self.name + ".html")) as template:
					template_str = template.read()
					template_str = template_str.replace("TOPICS_DOCS", json.dumps(weights_by_topic))
					template_str = template_str.replace("TOPIC_LABELS", json.dumps(labels))
					template_str = template_str.replace("TOPIC_COHERENCE", json.dumps(coherence))
					template_str = template_str.replace("TOPIC_PROPORTIONS", json.dumps(self.proportions))
					template_str = template_str.replace("TOPIC_STDEVS", json.dumps(self.stdevs))
					template_str = template_str.replace("TOPIC_CORRELATIONS", json.dumps(self.correlations))
					outfile.write(template_str)
		except:
			logging.error(traceback.format_exc())


if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "mallet.log"), level=logging.INFO)
		processor = MalletLDA(sys.argv, track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())