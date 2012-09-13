#!/usr/bin/env python
import sys, os, json, cStringIO, tempfile, logging, traceback, codecs, math
import wordcloud

class MultipleWordClouds(wordcloud.WordCloud):
	"""
	Generate word clouds based on labels
	"""
	def _basic_params(self):
		self.name = "wordcloud_multiple"
		self.width = "300"
		self.height = "150"
		self.fontsize = "[10,32]"
		self.n = 50
		self.tfidf_scoring = False
		self.MWW = False
		self.dunning = False
		if len(self.extra_args) > 0:
			if self.extra_args[0] == "tfidf":
				self.tfidf_scoring = True
			elif self.extra_args[0] == "mww":
				self.tfidf_scoring = True
				self.MWW = True
			elif self.extra_args[0] == "dunning":
				self.tfidf_scoring = True
				self.dunning = True

	def _rank_simple(self, vector):
	    return sorted(range(len(vector)), key=vector.__getitem__)

	def _rank(self, seq):
		n = len(seq)
		ivec = self._rank_simple(seq)
		svec = [seq[rank] for rank in ivec]
		last_obs = svec[0]
		new_vec = [1]*n
		dupe_indices = set()

		for i in xrange(1, n):
			if svec[i] == last_obs:
				dupe_indices.add(i-1)
				dupe_indices.add(i)
			else:
				if len(dupe_indices) > 0:
					averank = (sum(dupe_indices) / float(len(dupe_indices))) + 1
					for j in dupe_indices:
						new_vec[j] = averank
					new_vec[i] = i + 1
					dupe_indices = set()
				else:
					new_vec[i] = i + 1
			last_obs = svec[i]
		ranks = {svec[i]: rank for i, rank in enumerate(new_vec)}
		return ranks

	def _mannWhitney(self, A, B):
		all_obs = A + B
		n_a = len(A)
		n_b = len(B)
		n_ab = len(all_obs)

		ranks = self._rank(all_obs)
		t_a = sum([ranks[obs] for obs in A])
		mu_a = float(n_a * (n_ab + 1)) / 2
		t_a_max = (n_a * n_b) + (n_a * (len(A) + 1))/2
		u_a = t_a_max - t_a
		s = math.sqrt(float(n_a * n_b * (n_ab + 1))/12)
		if t_a > mu_a:
			z_a = (t_a - mu_a - 0.5)/ s
		else:
			z_a = (t_a - mu_a + 0.5)/ s
		rho = u_a / (n_a*n_b)
		return rho

	def _dunning_held_out(self, word, label_set, other_set):
		sets = [label_set, other_set]
		count_total = [0.0, 0.0, 0.0, 0.0]
		for i in range(len(sets)):
			for filename in sets[i]:
				if word in self.tf_by_doc[filename]:
					count_total[i] += self.tf_by_doc[filename][word]
				count_total[i + 2] += sum(self.tf_by_doc[filename].values())
			# count_total[i] = sum([word_weights[word] for filename, word_weights in self.tf_by_doc.iteritems() if filename in sets[i] and word in word_weights])
			# count_total[i + 2] = sum([sum(word_weights.values()) for filename, word_weights in self.tf_by_doc.iteritems() if filename in sets[i]])
		a, b, c, d = [float(x) for x in count_total]
		if any([x == 0 for x in count_total]):
			return 0
		E1 = c*((a+b)/(c+d))
		E2 = d*((a+b)/(c+d))
		G2 = 2.0*((a*math.log(a/E1)) + (b*math.log(b/E2)))
		return G2

	def _dunning(self, word, label_set):
		count_total = [0.0, self.freqs[word], 0.0, self.total_word_count]
		for filename in label_set:
			if word in self.tf_by_doc[filename]:
				count_total[0] += self.tf_by_doc[filename][word]
			count_total[2] += sum(self.tf_by_doc[filename].values())
		a, b, c, d = [float(x) for x in count_total]
		if any([x == 0 for x in count_total]):
			return 0
		E1 = c*((a+b)/(c+d))
		E2 = d*((a+b)/(c+d))
		G2 = 2.0*((a*math.log(a/E1)) + (b*math.log(b/E2)))
		return G2

	def _held_out(self, word, label_set, other_set):
		ranks_by_set = [[],[]]
		sets = [label_set, other_set]
		appears_in_label_set = False
		for i in range(len(sets)):
			for filename in sets[i]:
				if word in self.tf_by_doc[filename]:
					ranks_by_set[i].append(self.tf_by_doc[filename][word])
					if i == 0:
						appears_in_label_set = True
				# 	ranks_by_set[i].append(self.tf_by_doc[filename][word] * self.idf[word])
				else:
					ranks_by_set[i].append(0)
		if not appears_in_label_set:
			return 0.0
		else:
			return self._mannWhitney(ranks_by_set[0], ranks_by_set[1])

	def _split_into_labels(self):
		for filename, data in self.metadata.iteritems():
			if data["label"] not in self.labels:
				self.labels[data["label"]] = set()
			self.labels[data["label"]].add(filename)

	def process(self):
		logging.info("splitting into labeled sets")
		self.labels = {}
		self._split_into_labels()

		clouds = {}

		all_files = set(self.files)
		if self.tfidf_scoring:
			if self.dunning:
				self._findTfIdfScores(scale=False)
			else:
				self._findTfIdfScores()
			# self.top_tfidf_words = [item["text"] for item in self._topN(self.filtered_freqs, 150)]
			self.top_tfidf_words = self.filtered_freqs.keys()

		self.label_order = sorted(self.labels.keys())
		for label in self.label_order:
			filenames = self.labels[label]
			logging.info("finding word frequencies for " + str(label))
			if self.tfidf_scoring and self.MWW:
				label_set = set(filenames)
				other_set = all_files - label_set
				word_rho = {}
				for word in self.top_tfidf_words:
					word_rho[word] = self._held_out(word, label_set, other_set)
				clouds[label] = self._topN(word_rho)
			elif self.tfidf_scoring and self.dunning:
				label_set = set(filenames)
				other_set = all_files - label_set
				word_G2 = {}
				self.total_word_count = sum(self.freqs.values())
				for word in self.top_tfidf_words:
					G2 = self._dunning_held_out(word, label_set, other_set)
					# G2 = self._dunning(word, label_set)
					if G2 > 15.13: # critical value for p < 0.001
						word_G2[word] = G2
				clouds[label] = self._topN(word_G2)

			elif self.tfidf_scoring:
				tf_maxes = {}
				for filename in filenames:
					for term, weight in self.tf_by_doc[filename].iteritems():
						if term not in tf_maxes:
							tf_maxes[term] = weight
						else:
							if weight > tf_maxes[term]:
								tf_maxes[term] = weight
				tfidf_for_labelset = {term: weight * self.idf[term] for term, weight in tf_maxes.iteritems()}
				filtered_freqs_for_labelset = {term: freq for term, freq in self.filtered_freqs.iteritems() if term in tfidf_for_labelset}
				clouds[label] = self._topN(filtered_freqs_for_labelset)
			else:
				clouds[label] = self._findWordFreqs(filenames)

		params = {"CLOUDS": json.dumps(clouds),
				"ORDER": json.dumps(self.label_order),
				"WIDTH": self.width,
				"HEIGHT": self.height,
				"FONTSIZE": self.fontsize
		}

		self.write_html(params)


if __name__ == "__main__":
	try:
		processor = MultipleWordClouds(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())