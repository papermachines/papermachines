#!/usr/bin/env python2.7
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
import gzip
from lib.stemutil import stem
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
		if "features" in self.named_args:
			self.features = self.named_args["features"]
		else:
			self.features = "decade"

	def metadata_to_feature_string(self, doc):
		my_features = []
		metadata = self.metadata[doc]
		if "decade" in self.features:
			year = self.intervals[self.fname_to_index[doc]]
			decade = int(round(year, -1))
			my_features.append(u'decade{:}'.format(decade))
		if "place" in self.features:
			place = metadata["place"]
			my_features.append(self._sanitize_feature(place))
		if "label" in self.features:
			label = metadata["label"]
			my_features.append(self._sanitize_feature(label))
		return u' '.join(my_features)

	def _sanitize_feature(self, text):
		return re.sub('[\W_]+', '', text, re.UNICODE)

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
			self.lang = self.named_args["lang"]
		else:
			self.tfidf = True
			self.min_df = 5
			self.topics = 50
			self.stemming = True
			self.lang = "en"

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

		self.topic_features = {}
		with codecs.open(os.path.join(self.mallet_out_dir, 'dmr.parameters'), 'r', encoding='utf-8') as f:
			topic = 0
			for line in f:
				new_topic = re.match("FEATURES FOR CLASS topic([0-9]+)", line)
				if new_topic is not None:
					topic = int(new_topic.group(1))
				else:
					if not topic in self.topic_features:
						self.topic_features[topic] = {}
					this_line = line.split(' ')
					feature = this_line[1]
					self.topic_features[topic][feature] = float(this_line[2])		

		self.progress_file.seek(0, os.SEEK_SET)
		self.alphas = {}
		for line in self.progress_file:
			if re.match('[0-9]+\t[0-9.]+', line) is not None:
				this_line = line.split('\t')
				topic = int(this_line[0])
				alpha = float(this_line[1])
				tokens = int(this_line[2])

				self.alphas[topic] = alpha

		self.alpha_sum = sum(self.alphas.values()) # wrong, somehow

		self.topic_words = {}
		self.doc_topics = {}

		with gzip.open(os.path.join(self.mallet_out_dir, 'dmr.state.gz'), 'rb') as state_file:
			state_file.next()
			for line in state_file:
				this_line = line.split(' ')
				topic = int(this_line[5])
				word = this_line[4]
				doc = int(this_line[0])
				position = int(this_line[2])

				if not doc in self.doc_topics:
					self.doc_topics[doc] = {}
				if not topic in self.doc_topics[doc]:
					self.doc_topics[doc][topic] = 0
				self.doc_topics[doc][topic] += 1

				if not topic in self.topic_words:
					self.topic_words[topic] = {}
				if not word in self.topic_words[topic]:
					self.topic_words[topic][word] = 0
				self.topic_words[topic][word] += 1

		# total_tokens = float(sum([sum(y.values()) for x, y in self.topic_words.iteritems()]))
		for topic in self.topic_words.keys():
			total = float(sum(self.topic_words[topic].values()))
			for k in self.topic_words[topic].keys():
				self.topic_words[topic][k] /= total

		top_N = 20
		top_topic_words = dict((x, dict((word, y[word]) for word in self.argsort(y, reverse=True)[:top_N])) for x, y in self.topic_words.iteritems())
		wordProbs = [[{'text': word, 'prob': prob} for word, prob in y.iteritems()] for x, y in top_topic_words.iteritems()]

		DEFAULT_DOC_PROPORTIONS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5]
		numDocumentsAtProportions = dict((topic, dict((k, 0.0) for k in DEFAULT_DOC_PROPORTIONS)) for topic in self.topic_words.keys())
		for doc, topics in self.doc_topics.iteritems():
			doc_length = sum(topics.values())
			for topic, count in topics.iteritems():
				proportion = (self.alphas[topic] + count) / (self.alpha_sum + doc_length)
				for min_proportion in DEFAULT_DOC_PROPORTIONS:
					if proportion < min_proportion:
						break
					numDocumentsAtProportions[topic][min_proportion] += 1

		allocationRatios = dict((topic, proportions[0.5] / proportions[0.02]) for topic, proportions in numDocumentsAtProportions.iteritems())

		labels = dict((topic, {"label": self.argsort(words, reverse=True)[:3], "fulltopic": wordProbs[topic], "allocation_ratio": allocationRatios[topic]}) for topic, words in top_topic_words.iteritems())

		weights_by_topic = []
		doc_metadata = {}

		self._sort_into_intervals()

		for i in range(self.topics):
			weights_by_topic.append([{'x': str(j), 'y': [], 'topic': i} for j in self.intervals])		

		for doc in self.doc_topics.keys():
			total = float(sum(self.doc_topics[doc].values()))
			for k in self.doc_topics[doc].keys():
				self.doc_topics[doc][k] /= total

		for id, topics in self.doc_topics.iteritems():
			try:
				filename = self.docs[int(id)]

				itemid = self.metadata[filename]["itemID"]

				doc_metadata[itemid] = {"label": self.metadata[filename]["label"], "title": self.metadata[filename]["title"]}

				freqs = topics
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
				year_sum = 0.0
				if len(year['y']) != 0:
					for doc in year['y']:
						year_sum += doc['ratio']
					topic_sums.append(year_sum / float(len(year['y'])))
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
				"TOPIC_FEATURES": json.dumps(self.topic_features, separators=(',',':')),
				"TOPIC_COHERENCE": json.dumps({}, separators=(',',':')),
				"TOPIC_PROPORTIONS": json.dumps(self.proportions, separators=(',',':')),
				"TOPIC_STDEVS": json.dumps(self.stdevs, separators=(',',':')),
				"TOPIC_CORRELATIONS": json.dumps(self.correlations, separators=(',',':'))
		}

		index = getattr(self, "index", "{}")
		params["###INDEX###"] = json.dumps(index, separators=(',',':'))

		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletDMR(track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())