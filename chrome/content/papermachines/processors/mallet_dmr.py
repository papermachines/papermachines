#!/usr/bin/env python2.7
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
import gzip
from lib.porter2 import stem
import mallet_lda

class MalletDMR(mallet_lda.MalletLDA):
	"""
	Perform DMR using MALLET
	"""

	def _basic_params(self):
		self.categorical = False
		self.template_name = "mallet_dmr"
		self.name = "mallet_dmr"
		self.topics = 50
		self.dry_run = False
		self.dfr = len(self.extra_args) > 0
		if self.dfr:
			self.dfr_dir = self.extra_args[0]

	def metadata_to_feature_string(self, doc):
		feature_string = u''
		metadata = self.metadata[doc]
		year = self.intervals[self.fname_to_index[doc]]
		decade = int(round(year, -1))
		feature_string += u'decade{:}'.format(decade)
		return feature_string

	def _setup_mallet_instances(self, tfidf = False, stemming = True):
		self.stemming = stemming

		self._setup_mallet_command()
		self._import_texts()

		self.instance_file = os.path.join(self.mallet_out_dir, self.collection + ".mallet")

		logging.info("beginning text import")

		if tfidf and not self.dry_run:
			self._tfidf_filter()

		self._sort_into_intervals()

		os.rename(self.texts_file,self.texts_file + '-pre_dmr')

		with codecs.open(self.texts_file + '-pre_dmr', 'r', encoding='utf-8') as texts_file_old:
			with codecs.open(self.texts_file, 'w', encoding='utf-8') as texts_file:
				for line in texts_file_old:
					texts_file.write(line.split(u'\t')[-1])

		with codecs.open(os.path.join(self.mallet_out_dir, "metadata.json"), 'w', encoding='utf-8') as meta_file:
			json.dump(self.metadata, meta_file)

		self.features_file = os.path.join(self.mallet_out_dir, "features.txt")

		self.features_list = []
		for doc in self.docs:
			self.features_list.append(self.metadata_to_feature_string(doc))

		with codecs.open(self.features_file, 'w', encoding='utf-8') as features_file:
			features_file.writelines([x + u'\n' for x in self.features_list])

		import_args = self.mallet + ["cc.mallet.topics.tui.DMRLoader", 
			self.texts_file, self.features_file, self.instance_file]

		if not self.dry_run and not os.path.exists(self.instance_file):
			import_return = subprocess.call(import_args, stdout=self.progress_file)

	def process(self):
		"""
		run DMR, creating an output file divided by time
		"""

		if self.named_args is not None:
			self.tfidf = self.named_args["tfidf"]
			self.min_df = int(self.named_args["min_df"])
			self.stemming = self.named_args["stemming"]
			self.topics = int(self.named_args["topics"])
		else:
			self.tfidf = True
			self.min_df = 5
			self.topics = 50
			self.stemming = True

		self._setup_mallet_instances(tfidf=self.tfidf, stemming=self.stemming)

		process_args = self.mallet + ["cc.mallet.topics.DMRTopicModel",
			self.instance_file, str(self.topics)]
		logging.info("begin DMR")
		logging.info("command: " + ' '.join(process_args))

		start_time = time.time()
		os.chdir(self.mallet_out_dir)
		if not self.dry_run:
			dmr_return = subprocess.call(process_args, stdout=self.progress_file, stderr=self.progress_file)

		logging.info("DMR complete in " + str(time.time() - start_time) + " seconds")

		self.topic_words = {}

		with gzip.open(os.path.join(self.mallet_out_dir, 'dmr.state.gz'), 'rb') as state_file:
			state_file.next()
			for line in state_file:
				this_line = line.split(' ')
				topic = int(this_line[5])
				word = this_line[4]
				if not topic in self.topic_words:
					self.topic_words[topic] = {}
				if not word in self.topic_words[topic]:
					self.topic_words[topic][word] = 0
				self.topic_words[topic][word] += 1

		total_tokens = float(sum([sum(y.values()) for x, y in self.topic_words.iteritems()]))
		for topic in self.topic_words.keys():
			total = float(sum(self.topic_words[topic].values()))
			for k in self.topic_words[topic].keys():
				self.topic_words[topic][k] /= total

		top_N = 20
		top_topic_words = {x: {word: y[word] for word in self.argsort(y)[-1:-top_N:-1]} for x, y in self.topic_words.iteritems()}
		wordProbs = [[{'text': word, 'prob': prob} for word, prob in y.iteritems()] for x, y in top_topic_words.iteritems()]

		allocationRatios = {}

		# coherence = {}
		# wordProbs = {}
		# allocationRatios = {}
		# with file(self.mallet_files['diagnostics-file']) as diagnostics:
		# 	tree = et.parse(diagnostics)
		# 	for elem in tree.iter("topic"):
		# 		topic = elem.get("id")
		# 		coherence[topic] = float(elem.get("coherence"))
		# 		allocationRatios[topic] = float(elem.get("allocation_ratio"))
		# 		wordProbs[topic] = []
		# 		for word in elem.iter("word"):
		# 			wordProbs[topic].append({'text': word.text, 'prob': word.get("prob")})

		# labels = {x[0]: {"label": x[2:5], "fulltopic": wordProbs[x[0]], "allocation_ratio": allocationRatios[x[0]]} for x in [y.split() for y in file(self.mallet_files['topic-keys']).readlines()]}

		# weights_by_topic = []
		# doc_metadata = {}

		# self._sort_into_intervals()

		# for i in range(self.topics):
		# 	weights_by_topic.append([{'x': str(j), 'y': [], 'topic': i} for j in self.intervals])		

		# for line in file(self.mallet_files['doc-topics']):
		# 	try:
		# 		values = line.split('\t')
				
		# 		id = values.pop(0)
		# 		if id.startswith("#doc"):
		# 			continue
		# 		filename = self.docs[int(id)]
		# 		del values[0]

		# 		itemid = self.metadata[filename]["itemID"]

		# 		doc_metadata[itemid] = {"label": self.metadata[filename]["label"], "title": self.metadata[filename]["title"]}

		# 		freqs = {int(y[0]): float(y[1]) for y in self.xpartition(values)}
		# 		main_topic = None
		# 		topic_max = 0.0
		# 		for i in freqs.keys():
		# 			weights_by_topic[i][self.fname_to_index[filename]]['y'].append({"itemID": itemid, "ratio": freqs[i]})
		# 			if freqs[i] > topic_max:
		# 				main_topic = i
		# 				topic_max = freqs[i]
		# 		doc_metadata[itemid]["main_topic"] = main_topic
		# 	except KeyboardInterrupt:
		# 		sys.exit(1)
		# 	except:
		# 		logging.error(traceback.format_exc())

		# topics_by_year = []
		# for topic in weights_by_topic:
		# 	topic_sums = []	
		# 	for year in topic:
		# 		sum = 0.0
		# 		if len(year['y']) != 0:
		# 			for doc in year['y']:
		# 				sum += doc['ratio']
		# 			topic_sums.append(sum / float(len(year['y'])))
		# 		else:
		# 			topic_sums.append(0)
		# 	topics_by_year.append(topic_sums)

		# self.topics_by_year = topics_by_year
		# self._find_proportions(topics_by_year)
		# try:		
		# 	self._find_stdevs(topics_by_year)
		# 	self._find_correlations(topics_by_year)
		# except:
		# 	self.stdevs = {}
		# 	self.correlations = {}

		# self.template_filename = os.path.join(self.cwd, "templates", self.template_name + ".html")

		# params = {"CATEGORICAL": "true" if self.categorical else "false",
		# 		"TOPICS_DOCS": json.dumps(weights_by_topic, separators=(',',':')),
		# 		"DOC_METADATA": json.dumps(doc_metadata, separators=(',',':')),
		# 		"TOPIC_LABELS": json.dumps(labels, separators=(',',':')),
		# 		"TOPIC_COHERENCE": json.dumps(coherence, separators=(',',':')),
		# 		"TOPIC_PROPORTIONS": json.dumps(self.proportions, separators=(',',':')),
		# 		"TOPIC_STDEVS": json.dumps(self.stdevs, separators=(',',':')),
		# 		"TOPIC_CORRELATIONS": json.dumps(self.correlations, separators=(',',':'))
		# }

		# index = getattr(self, "index", "{}")
		# params["###INDEX###"] = json.dumps(index, separators=(',',':'))

		# self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletDMR(track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())