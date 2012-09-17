Zotero.PaperMachines = {
	DB: null,
	schema: {
		'files_to_extract': "CREATE TABLE files_to_extract (filename VARCHAR(255), itemID INTEGER, outfile VARCHAR(255), collection VARCHAR(255), UNIQUE(filename, itemID) ON CONFLICT IGNORE);",
		'doc_files': "CREATE TABLE doc_files (itemID INTEGER PRIMARY KEY, filename VARCHAR(255));",
		'collections': "CREATE TABLE collections (id INTEGER PRIMARY KEY, parent VARCHAR(255), child VARCHAR(255), FOREIGN KEY(parent) REFERENCES collection_docs(collection), FOREIGN KEY(child) REFERENCES collection_docs(collection), UNIQUE(parent, child) ON CONFLICT IGNORE);",
		'collection_docs': "CREATE TABLE collection_docs (id INTEGER PRIMARY KEY, collection VARCHAR(255), itemID INTEGER, FOREIGN KEY(itemID) REFERENCES doc_files(itemID), UNIQUE(collection, itemID) ON CONFLICT IGNORE);",
		'processed_collections': "CREATE TABLE processed_collections (id INTEGER PRIMARY KEY, process_path VARCHAR(255), collection VARCHAR(255), processor VARCHAR(255), status VARCHAR(255), progressfile VARCHAR(255), outfile VARCHAR(255), timeStamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(collection) REFERENCES collection_docs(collection), UNIQUE(process_path) ON CONFLICT REPLACE); CREATE TRIGGER insert_processed_collections_timeStamp AFTER INSERT ON processed_collections BEGIN UPDATE processed_collections SET timeStamp = DATETIME('NOW') WHERE rowid = new.rowid; END; CREATE TRIGGER update_processed_collections_timeStamp AFTER UPDATE ON processed_collections BEGIN UPDATE processed_collections SET timeStamp = DATETIME('NOW') WHERE rowid = new.rowid; END;",
		'datasets': "CREATE TABLE datasets (id INTEGER PRIMARY KEY, type VARCHAR(255), path VARCHAR(255))"
	},
	processQuery: "SELECT * FROM processed_collections WHERE process_path = ?;",
	pm_dir: null,
	csv_dir: null,
	extract_csv_dir: null,
	out_dir: null,
	log_dir: null,
	args_dir: null,
	install_dir: null,
	tagCloudReplace: true,
	processors_dir: null,
	processors: ["wordcloud", "phrasenet", "mallet", "mallet_classify", "geoparse", "dbpedia", "export-output"],
	processNames: null, // see locale files
	prompts: null,
	processesThatPrompt: {
		"mallet_classify-file": function () {
			// get list of classifiers
			var classifiers = [];
			var classifiedCollections = Zotero.PaperMachines.DB.columnQuery("SELECT collection FROM processed_collections WHERE status = 'done' AND processor='mallet_train-classifier';");
			classifiedCollections.forEach(function (collection) {
				var classifier = Zotero.PaperMachines.out_dir.clone();
				classifier.append("mallet_train-classifier" + collection);
				classifier.append("trained.classifier");
				if (classifier.exists()) {
					classifiers.push({"name": Zotero.PaperMachines.getNameOfGroup(collection), "label": "-", "value": classifier.path});
				}
			})
			return Zotero.PaperMachines.selectFromOptions("mallet_classify-file", classifiers);
		},
		"wordcloud_chronological": function () {
			return Zotero.PaperMachines.textPrompt("wordcloud_chronological", "90");
		},
		"mallet_lda_jstor": function () {
			return Zotero.PaperMachines.filePrompt("mallet_lda_jstor", "multi", [".zip"]);
		},
	},
	communicationObjects: {},
	noTagsString: "",

	SCHEME: "zotero://papermachines",

	channel: {
		INTERFACE_URI: "chrome://papermachines/content/processors/support/nowordcloud.html",
		newChannel: function (uri) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);

			var Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
	
			try {
				var [path, queryString] = uri.path.substr(1).split('?');
				var pathParts = path.split('/');

				var file = false;
				var _uri = "data:text/html,";
				var progbar_str = '<html><head><meta http-equiv="refresh" content="2;URL=' + 
					"'zotero://papermachines/" + path + "'" + '"/></head>' +
					'<body><progress id="progressBar"/></body></html>';
				_uri += encodeURIComponent(progbar_str);


				if (pathParts[0] == "search") {
					var ids = Zotero.PaperMachines.search(queryString);
					_uri = "data:application/json," + encodeURIComponent(JSON.stringify(ids));
				} else {
					var file1 = Zotero.PaperMachines.out_dir.clone();
					if (pathParts.indexOf("support") != -1) {
						file1.append("support");
					}
					file1.append(pathParts.slice(-1)[0]);					

					if (file1.exists()) {
						file = file1;
					} else {
						var processResult = Zotero.PaperMachines.DB.rowQuery(Zotero.PaperMachines.processQuery, [path]);
						if (processResult) {
							switch (processResult["status"]) {
								case "done":
									if (processResult["processor"] == "extract") {
										var finished_path = processResult["progressfile"].replace("progress.html",".json");
										Zotero.PaperMachines.addExtractedToDB(finished_path);										
									}

									file = Components.classes["@mozilla.org/file/local;1"]
										.createInstance(Components.interfaces.nsILocalFile);
									file.initWithPath(processResult["outfile"]);

									var mostRecentExtractionQuery = "SELECT MAX(timeStamp) FROM processed_collections " +
										"WHERE processor='extract' AND collection = ? OR collection in " +
										"(SELECT parent FROM collections WHERE child = ?);";

									var c = processResult["collection"];
									var mostRecentExtraction = Zotero.PaperMachines.DB.valueQuery(mostRecentExtractionQuery, [c, c]);

									if (mostRecentExtraction && processResult["timeStamp"] < mostRecentExtraction) {
										Zotero.PaperMachines.DB.query("UPDATE processed_collections SET status = 'failed' WHERE process_path = ?;", [path]);
										file = false;
									}

									if (!file || !file.exists()) {
										file = false;
										Zotero.PaperMachines.DB.query("UPDATE processed_collections SET status = 'failed' WHERE process_path = ?;", [path]);
										// Zotero.PaperMachines._runProcessPath(path);
									}
									break;
								case "running":
									_uri = "data:text/html,";
									_uri += encodeURIComponent(Zotero.PaperMachines._generateProgressPage(processResult));
									break;
								case "failed":
									Zotero.PaperMachines._runProcessPath(path);
									break;
								default:
									Zotero.PaperMachines.LOG(processResult);
							}
						} else {
							Zotero.PaperMachines._runProcessPath(path);
						}
					}
				}

				if (file) {
					var ph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
								.createInstance(Components.interfaces.nsIFileProtocolHandler);
					return ioService.newChannelFromURI(ph.newFileURI(file));
				} else {
					var ext_uri = ioService.newURI(_uri, null, null);
					var extChannel = ioService.newChannelFromURI(ext_uri);

					return extChannel;
				}

			} catch (e){
				Zotero.PaperMachines.LOG(e);
			   throw (e);
			}
		}
	},
	init: function () {
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");

		var protocol = Components.classes["@mozilla.org/network/protocol;1?name=zotero"]
								 .getService(Components.interfaces.nsIProtocolHandler)
								 .wrappedJSObject;
		protocol._extensions[this.SCHEME] = this.channel;

		this.pm_dir = this._getOrCreateDir("papermachines", Zotero.getZoteroDirectory());
		this.csv_dir = this._getOrCreateDir("csv");
		this.extract_csv_dir = this._getOrCreateDir("extractcsv");
		this.out_dir = this._getOrCreateDir("out");
		this.processors_dir = this._getOrCreateDir("processors");
		this.log_dir = this._getOrCreateDir("logs", this.out_dir);
		this.args_dir = this._getOrCreateDir("args");

		this.selectStoplist("en");

		this.getStringsFromBundle();

		try {
			var tagSelector = ZoteroPane.document.getElementById("zotero-tag-selector");
			if (tagSelector && "id" in tagSelector && tagSelector.id("no-tags-box") && tagSelector.id("no-tags-box").firstChild) {
				Zotero.PaperMachines.noTagsString = tagSelector.id("no-tags-box").firstChild.value;			
			}
		} catch (e) {}


		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		AddonManager.getAddonByID("papermachines@chrisjr.org",
			function(addon) {
				Zotero.PaperMachines._updateBundledFilesCallback(addon.getResourceURI().QueryInterface(Components.interfaces.nsIFileURL).file);
			});

		// Connect to (and create, if necessary) papermachines.sqlite in the Zotero directory
		this.DB = new Zotero.DBConnection('papermachines');

		for (var i in this.schema) {
			if (!this.DB.tableExists(i)) {
				this.DB.query(this.schema[i]);
			}
		}

		this.DB.query("UPDATE processed_collections SET status = 'failed' WHERE status = 'running';");
		this.DB.query("DELETE from files_to_extract;");

		win.setTimeout(Zotero.PaperMachines.replaceOnCollectionSelected, 5000);

		// ZoteroPane.addReloadListener(function () {
		// 	setTimeout(Zotero.PaperMachines.replaceOnCollectionSelected, 5000);		
		// });
	},
	extractText: function () {
		var itemGroup = ZoteroPane.getItemGroup();
		var id = this.getItemGroupID(itemGroup);

		var pdftotext = Zotero.getZoteroDirectory();
		pdftotext.append(Zotero.Fulltext.pdfConverterFileName);

		var path = "zotero://papermachines/extract/" + Zotero.PaperMachines.getItemGroupID(itemGroup) + "/" + encodeURIComponent(pdftotext.path);
		this.DB.beginTransaction();
		this.DB.query("UPDATE processed_collections SET status = 'failed' WHERE processor='extract' AND collection = ?;", [id]);
		this.DB.query("DELETE FROM collection_docs WHERE collection = ? OR collection IN (SELECT child FROM collections WHERE parent = ?);", [id, id]);
		this.DB.commitTransaction();

		var queue = new Zotero.PaperMachines._Sequence(function() {
			Zotero.UnresponsiveScriptIndicator.enable();
			Zotero.hideZoteroPaneOverlay();
			Zotero.PaperMachines.openWindowOrTab(path);
		});

		Zotero.UnresponsiveScriptIndicator.disable();

		queue.grandTotal = Zotero.PaperMachines.countItemsInGroup(itemGroup) || 1000;

		Zotero.showZoteroPaneProgressMeter("Searching for files to extract");

		this.captureCollectionTreeStructure(itemGroup);

		this.processItemGroup(itemGroup, function (group) {
			queue.add(Zotero.PaperMachines.extractFromItemGroup, group, queue);
		});

		queue.next();
	},
	countText: function () {
		var itemGroup = ZoteroPane.getItemGroup();
		var id = this.getItemGroupID(itemGroup);
		var docs = this.DB.valueQuery("SELECT COUNT(*) FROM collection_docs WHERE collection = ? OR collection IN (SELECT child FROM collections WHERE parent = ?);", [id, id]);
		var count = Zotero.PaperMachines.countItemsInGroup(itemGroup);

		var label = (docs*100.0/count).toString() + "%; " + docs.toString() + " out of " + count.toString() + " docs in DB";

		alert(label);
	},
	_sanitizeFilename: function (filename) {
		return filename.replace(/_/g,"-").replace(/ /g,"_").replace(/[^-A-Za-z0-9_.]/g,"").substring(0,64);
	},
	/**
	 * Returns an nsIFile object for the requested dir, creating it if necessary
	 * @param {String} dir name of desired directory
	 * @param {nsIFile} [parent] the parent directory, defaults to "papermachines" dir
	*/
	_getOrCreateDir: function(dir, parent) {
		parent = parent || this.pm_dir;
		return this._getOrCreateNode(dir, parent, true);
	},
	_getOrCreateFile: function(file, parent) {
		parent = parent || this.pm_dir;
		return this._getOrCreateNode(file, parent, false);
	},
	_getLocalFile: function (path) {
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		return file;
	},
	_getOrCreateNode: function (node, parent, dir_or_file) {
		parent = parent || this.pm_dir;
		newNode = parent.clone();	
		newNode.append(node);

		if (!newNode.exists()) {
			if (dir_or_file) {
				newNode.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
			} else {
				newNode.create(Components.interfaces.nsIFile.FILE_TYPE, 0644);
			}
		}
		return newNode;	
	},
	runProcess: function () {
		var func_args = Array.prototype.slice.call(arguments);
		var processPathParts = [func_args[0]];

		processPathParts.push(Zotero.PaperMachines.getThisGroupID());

		var additional_args = func_args.slice(1);

		if (processPathParts[0] in Zotero.PaperMachines.processesThatPrompt) {
			var prompt_result = Zotero.PaperMachines.processesThatPrompt[processPathParts[0]]();
			if (prompt_result) additional_args.push.apply(additional_args, prompt_result);
			else return;
		}

		additional_args = additional_args.map(function (d) { return encodeURIComponent(d);});

		processPathParts = processPathParts.concat(additional_args);
		Zotero.PaperMachines.openWindowOrTab("zotero://papermachines/"+processPathParts.join('/'), processPathParts[0]);
	},
	_checkIfRunning: function (processPath) {
		var sql = "SELECT id FROM processed_collections WHERE process_path = ? AND status = 'running';";
		return Zotero.PaperMachines.DB.query(sql, [processPath]);
	},
	_runProcessPath: function (processPath) {
		var processPathParts = processPath.split('/'),
			processor = processPathParts[0],
			thisID = processPathParts[1],
			additional_args = processPathParts.slice(2).map(function (d) { return decodeURIComponent(d);});

		var processName = processor + thisID;
		var thisGroup = Zotero.PaperMachines.getGroupByID(thisID);
		var collectionName = thisGroup.name || thisGroup.getName();

		if (Zotero.PaperMachines._checkIfRunning(processPath)) {
			return;
		}

		var proc_file = Zotero.PaperMachines.processors_dir.clone();
		proc_file.append(processor + ".pyw");

		var proc = Components.classes["@mozilla.org/process/util;1"]
			.createInstance(Components.interfaces.nsIProcess);

		if (processor == "extract") {
			var csv = Zotero.PaperMachines.buildExtractCSV(thisID);
		} else {
			var csv = Zotero.PaperMachines.buildCSV(thisGroup);
		}

		var progressFile = Zotero.PaperMachines._getOrCreateFile(processor + thisID + "progress.html", Zotero.PaperMachines.out_dir);
		var outFile = Zotero.PaperMachines.out_dir.clone();

		var args = [Zotero.PaperMachines.processors_dir.path, csv.path, Zotero.PaperMachines.out_dir.path, collectionName];
		args = args.concat(additional_args);

		var args_str = JSON.stringify(args);
		var args_hash = Zotero.PaperMachines.argsHash(args_str);
		var argsHashFilename = args_hash + ".json";
		var argFile = Zotero.PaperMachines._getOrCreateFile(argsHashFilename, Zotero.PaperMachines.args_dir);
		Zotero.File.putContents(argFile, args_str);

		var procArgs = [argFile.path];

		outFile.append(processor + thisID + "-" + args_hash + ".html");

		var sql = "INSERT OR REPLACE INTO processed_collections (process_path, collection, processor, status, progressfile, outfile) " +
			" values (?, ?, ?, ?, ?, ?);";
		Zotero.PaperMachines.DB.query(sql, [processPath, thisID, processor, "running", progressFile.path, outFile.path]);

		var callback = function (finished) {
			if (finished) {
				var sql_update = "UPDATE processed_collections SET status = 'done' WHERE process_path = ?;";
				Zotero.PaperMachines.DB.query(sql_update, [this.processPath]);
			} else {
				var sql_update = "UPDATE processed_collections SET status = 'failed' WHERE process_path = ?;";
				Zotero.PaperMachines.DB.query(sql_update, [this.processPath]);
			}
		};

		var observer = new this.processObserver(processor, processPath, callback);

		proc.init(proc_file);
		proc.runAsync(procArgs, procArgs.length, observer);
	},
	replaceTagsBoxWithWordCloud: function (uri) {
		const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		var iframe = document.createElementNS(XUL_NS, "iframe");
		iframe.setAttribute("src", uri);
		iframe.setAttribute("id", "no-tags-box");
		iframe.setAttribute("height", 160);
		iframe.setAttribute("flex", 2);
		var tagSelector = ZoteroPane.document.getElementById("zotero-tag-selector");
		var tagSelectorGroup = ZoteroPane.document.getAnonymousNodes(tagSelector)[0];

		var currentBox = tagSelector.id("no-tags-box");
		tagSelectorGroup.replaceChild(iframe, currentBox);

		iframe.collapsed = false;

		tagSelector.id("tags-toggle").collapsed = true;
	},
	restoreTagsBox: function () {
		var tagSelector = ZoteroPane.document.getElementById("zotero-tag-selector");
		var tagSelectorGroup = ZoteroPane.document.getAnonymousNodes(tagSelector)[0];
		const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		var noTagsBox = document.createElementNS(XUL_NS, "vbox");
		noTagsBox.setAttribute("id", "no-tags-box");
		noTagsBox.setAttribute("align", "center");
		noTagsBox.setAttribute("pack", "center");
		noTagsBox.setAttribute("flex", "1");
		var label = document.createElementNS(XUL_NS, "label");
		label.setAttribute("value", Zotero.PaperMachines.noTagsString);
		noTagsBox.appendChild(label);

		var currentBox = tagSelector.id("no-tags-box");
		if (currentBox.tagName == "iframe") {
			tagSelectorGroup.replaceChild(noTagsBox, currentBox);
			noTagsBox.collapsed = !tagSelector._empty;
		}
	},
	onCollectionSelected: function () {
		var thisID = Zotero.PaperMachines.getThisGroupID();
		try {
			Zotero.PaperMachines.activateMenuItems(thisID);
		} catch (e) {Zotero.PaperMachines.LOG(e)}

		if (Zotero.PaperMachines.tagCloudReplace) {
			if (!Zotero.PaperMachines.hasBeenExtracted(thisID)) {
				Zotero.PaperMachines.restoreTagsBox();
			} else {
				Zotero.PaperMachines.displayWordCloud();
			}
		}
	},
	replaceOnCollectionSelected: function () {
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");

		if (ZoteroPane && ZoteroPane.loaded && ZoteroPane.collectionsView && ZoteroPane.collectionsView.selection && !ZoteroPane.onCollectionSelected_) {
			if (Zotero.PaperMachines.tagCloudReplace) {
				ZoteroPane.document.getElementById("zotero-tag-selector").uninit();				
			}

			ZoteroPane.onCollectionSelected_ = ZoteroPane.onCollectionSelected;
			ZoteroPane.onCollectionSelected = function () {
				ZoteroPane.onCollectionSelected_();
				try {
					Zotero.PaperMachines.onCollectionSelected();
				} catch (e) {
					Zotero.PaperMachines.LOG(e.name + ": " + e.message);
				}
			};
			win.setTimeout(Zotero.PaperMachines.onCollectionSelected, 500);
		} else {
			win.setTimeout(Zotero.PaperMachines.replaceOnCollectionSelected, 2000);
		}
	},
	displayWordCloud: function () {
		var thisID = Zotero.PaperMachines.getItemGroupID(ZoteroPane.getItemGroup());

		var wordCloudURI = "zotero://papermachines/wordcloud/" + thisID;
		Zotero.PaperMachines.replaceTagsBoxWithWordCloud(wordCloudURI);
	},
	buildExtractCSV: function (thisID) {
		var query = "SELECT filename, itemID, outfile, collection FROM files_to_extract;";
		var docs = this.DB.query(query);

		var csv_file = this.extract_csv_dir.clone();
		csv_file.append(thisID + ".csv");
	
		var csv_str = "";
		var header = ["filename", "itemID", "outfile", "collection"];
		csv_str += header.join(",") + "\n";
		for (var i in docs) {
			var row = [];
			for (var k in header) {
				var val;
				if (header[k] in docs[i]) {
					val = docs[i][header[k]];
				}

				if (typeof val == "string") {
					val = val.replace(/"/g, ""); //remove quotes
					if (val.indexOf(',') != -1) {
						val = '"' + val + '"';
					}
				}

				row.push(val);			
			}
			csv_str += row.join(",") + "\n";
		}
		Zotero.File.putContents(csv_file, csv_str);
		return csv_file;
	},
	addExtractedToDB: function(path) {
		var extracted = Zotero.PaperMachines._getLocalFile(path);
		var json_data = Zotero.File.getContents(extracted);
		var docs = JSON.parse(json_data);
		for (var i in docs) {
			var doc = docs[i];
			Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO doc_files (itemID, filename) VALUES (?,?)", [doc.itemID, doc.filename]);
			Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO collection_docs (collection,itemID) VALUES (?,?)", [doc.collection, doc.itemID]);
			Zotero.PaperMachines.DB.query("DELETE FROM files_to_extract WHERE itemID = ?;", [doc.itemID]);
		}
	},
	buildDocArray: function(collection) {
		var docs = [];
		this.processItemGroup(collection, function (itemGroup) {
			var thisGroup = Zotero.PaperMachines.getItemGroupID(itemGroup);
			var groupName = itemGroup.getName();

			if ("getItems" in itemGroup) {
				var items = itemGroup.getItems();
			} else if ("getChildItems" in itemGroup) {
				var items = itemGroup.getChildItems();
			}

			for (var i in items) {
				var item = items[i];
				if (item.isRegularItem()) {
					var filename = Zotero.PaperMachines.findItemInDB(item);
					if (filename) {
						docs.push({"itemID": item.id, "filename": filename, "label": groupName});
					}
				}
			}
		});
		// var query = "SELECT itemID, filename FROM doc_files WHERE itemID IN " +
		// 			"(SELECT itemID FROM collection_docs WHERE collection = ? OR collection IN " +
		// 			"(SELECT child FROM collections WHERE parent = ?));";

		// var docs = this.DB.query(query, [id, id]);
		return docs;
	},
	buildCSV: function(collection) {
		var id = this.getItemGroupID(collection);
		if (!id) return false;

		var csv_file = this.csv_dir.clone();
		csv_file.append(id + ".csv");
		if (!csv_file.exists()) {
			csv_file.create(Components.interfaces.nsIFile.FILE_TYPE, 0644);
		}

		var csv_str = "";
		var header = ["filename", "itemID", "title", "label", "key", "year", "date", "place"];
		csv_str += header.join(",") + "\n";

		var docs = this.buildDocArray(collection);
		if (docs.length == 0) return false;

		for (var i in docs) {
			var row = [];
			var item = Zotero.Items.get(docs[i]["itemID"]);
			for (var k in header) {
				var val;
				if (header[k] in docs[i]) {
					val = docs[i][header[k]];
				} else if (header[k] == "year") {
					val = this.getYearOfItem(item);
				} else if (header[k] == "date") {
					val = item.getField("date", true, true);
				} else if (header[k] == "place") {
					val = item.getField("place");
				} else if (header[k] == "key") {
					val = item.key;
				} else if (header[k] == "label") {
					val = this.getCollectionOfItem(item);
				} else {
					try {
						val = item.getField(header[k]);
					} catch (e) { val = "";}
				}

				if (typeof val == "string") {
					val = val.replace(/"/g, ""); //remove quotes
					if (val.indexOf(',') != -1) {
						val = '"' + val + '"';
					}
				}
				row.push(val);		
			}
			csv_str += row.join(",") + "\n";
		}
		Zotero.File.putContents(csv_file, csv_str);
		return csv_file;
	},
	captureCollectionTreeStructure: function (collection) {
		this.processItemGroup(collection, function (itemGroup) {
			if ("isCollection" in itemGroup && itemGroup.isCollection()) {
				var thisCollection = itemGroup.hasOwnProperty("ref") ? itemGroup.ref : itemGroup;
				var childID = Zotero.PaperMachines.getItemGroupID(itemGroup);

				while (thisCollection.parent != null) {
					var parentID = (thisCollection.libraryID != null ? thisCollection.libraryID.toString() : "") + "C" + thisCollection.parent;
					Zotero.PaperMachines.DB.query("INSERT OR REPLACE INTO collections (parent,child) VALUES (?,?)", [parentID, childID]);
					thisCollection = Zotero.Collections.get(thisCollection.parent);
				}
				Zotero.PaperMachines.DB.query("INSERT OR REPLACE INTO collections (parent,child) VALUES (?,?)", [thisCollection.libraryID != null ? thisCollection.libraryID.toString() : "", childID]);
			}
		});
	},
	traverse: function () {
		var itemGroup = ZoteroPane.getItemGroup();
		var collections = Zotero.PaperMachines.captureCollectionTreeStructure(itemGroup);
		var names = "";

		this.processItemGroup(itemGroup, function (group) { names += group.getName() + ", "; });
		alert(names);
	},
	_iterateOverItemGroups: function (itemGroups, callback) {
		for (var i in itemGroups) {
			if (Array.prototype.isPrototypeOf(itemGroups[i])) {
				Zotero.PaperMachines._iterateOverItemGroups(itemGroups[i], callback);
			} else {
				callback(itemGroups[i]);
			}
		}
	},
	processItemGroup: function (itemGroup, callback) {
		var itemGroups = this.traverseItemGroup(itemGroup);
		this._iterateOverItemGroups(itemGroups, callback);
	},
	traverseItemGroup: function (itemGroup) {
		var itemGroups = [];
		if ("isLibrary" in itemGroup && itemGroup.isLibrary()) {
			if (itemGroup.id == "L") {
				itemGroups.push(ZoteroPane.collectionsView._dataItems[0][0]);
				var collectionKeys = Zotero.DB.columnQuery("SELECT key from collections WHERE libraryID IS NULL;");
				if (collectionKeys) {
					itemGroups = collectionKeys.map(function(d) { return Zotero.Collections.getByLibraryAndKey(null, d); });
				}
			}
		} else {
			if ("isCollection" in itemGroup && itemGroup.isCollection()) {
				itemGroups.push(itemGroup);
				var currentCollection = ("ref" in itemGroup) ? itemGroup.ref : itemGroup;
				if (currentCollection.hasChildCollections()) {
					var children = currentCollection.getChildCollections();
					for (var i in children) {
						itemGroups.push(Zotero.PaperMachines.traverseItemGroup(children[i]));
					}
				}
			} else if ("isGroup" in itemGroup && itemGroup.isGroup()) {
				if (itemGroup.ref.hasCollections()) {
					var children = itemGroup.ref.getCollections();
					for (var i in children) {
						itemGroups.push(Zotero.PaperMachines.traverseItemGroup(children[i]));
					}				
				}
			}
		}
		return itemGroups;
	},
	showTextInTopicView: function () {
		var items = ZoteroPane.getSelectedItems();
		var objs = Object.keys(Zotero.PaperMachines.communicationObjects);
		if (objs.length == 0) {
			var listenerID = "/mallet/" + Zotero.PaperMachines.getThisGroupID();
			Zotero.PaperMachines.openWindowOrTab("zotero://papermachines"+listenerID, listenerID);
		}
		// Zotero.PaperMachines.sendMessageTo(listenerID, "receive-select", {"itemID": items[0].id});
		// alert(Zotero.PaperMachines.getFilenameForItem(items[0]));
	},
	locateTextInMapView: function () {
		var items = ZoteroPane.getSelectedItems();
		var location = this.getPlaceOfItem(items[0]);
		alert(location);
	},
	getPlaceOfItem: function (item) {
		var path = this.DB.valueQuery("SELECT filename FROM doc_files WHERE itemID = ?;",[item.id]);
		var place = false;

		if (path) {
			var geoparseFile = Zotero.PaperMachines._getLocalFile(path.replace(".txt", "_geoparse.json"));
			if (geoparseFile.exists()) {
				var geoparse = JSON.parse(Zotero.File.getContents(geoparseFile));
				if (geoparse["city"]) {
					place = geoparse["city"];
				}
			}
		}
		return place;
	},
	getYearOfItem: function (item) {
		return item.getField("date", true, true).substring(0,4);
	},
	getCollectionOfItem: function (item) {
		return this.DB.valueQuery("SELECT collection FROM collection_docs WHERE itemID = ? LIMIT 1;", [item.id]);
	},
	findItemInDB: function (item) {
		var filename = this.DB.valueQuery("SELECT filename FROM doc_files WHERE itemID = ?;",[item.id]);
		var existent = false;
		if (filename) {
			var text = Zotero.PaperMachines._getLocalFile(filename);
			existent = text.exists();
			if (!existent) {
				this.DB.query("DELETE FROM doc_files WHERE filename = ?;", [docs[i]["filename"]]);
			}
		}
		return existent ? filename : false;
	},
	countItemsInGroup: function (itemGroup) {
		var count = 0;
		var query = "SELECT COUNT(DISTINCT itemID) FROM collectionItems WHERE collectionID = ?" +
			" AND itemID in (SELECT sourceItemID FROM itemAttachments WHERE " +
			"mimeType = 'application/pdf' OR mimeType = 'text/html');";
		this.processItemGroup(itemGroup, function (itemGroup) {
			if ("isCollection" in itemGroup && itemGroup.isCollection()) {
				var id = (itemGroup.hasOwnProperty("ref") ? itemGroup.ref.id : itemGroup.id);
				count += Zotero.DB.valueQuery(query, [id]);
			}
		});

		return count;
	},
	hasBeenExtracted: function (itemGroupID) {
		var sql = "SELECT itemID FROM collection_docs WHERE collection = ? OR collection IN " +
					"(SELECT child FROM collections WHERE parent = ?);";
		return this.DB.query(sql, [itemGroupID, itemGroupID]);
	},
	hasBeenProcessed: function (itemGroupID, processor) {
		var sql = "SELECT id FROM processed_collections WHERE collection = ? AND processor = ? AND status = 'done';";

		return this.DB.query(sql, [itemGroupID, processor]);
	},
	getItemGroupID: function (itemGroup) {
		if (!itemGroup) return null;
		if ("isCollection" in itemGroup && itemGroup.isCollection()) {
			if (itemGroup.hasOwnProperty("ref")) {
				return (itemGroup.ref.libraryID != null ? itemGroup.ref.libraryID.toString() : "") + "C" + itemGroup.ref.id.toString();				
			} else {
				return (itemGroup.libraryID != null ? itemGroup.libraryID.toString() : "") + "C" + itemGroup.id.toString();								
			}
		} else if ("isGroup" in itemGroup && itemGroup.isGroup()) {
			return itemGroup.ref.libraryID;
		} else {
			return itemGroup.id;
		}
	},
	getGroupByID: function (id) {
		if (id.indexOf("C") != -1) {
			return Zotero.Collections.get(id.split("C")[1]);
		} else if (id == "L") {
			return ZoteroPane.collectionsView._dataItems[0][0];
		} else {
			try {
				return Zotero.Groups.getByLibraryID(id);
			} catch (e) {  return false; }
		}
	},
	getNameOfGroup: function (id) {
		try {
			return Zotero.PaperMachines.getGroupByID(id).getName();		
		}
		catch (e) { return false; }
	},
	extractFromItemGroup: function (itemGroup, queue) {
		var thisGroup = Zotero.PaperMachines.getItemGroupID(itemGroup);
		var dir = Zotero.PaperMachines._getOrCreateDir(thisGroup);
		// Zotero.showZoteroPaneProgressMeter(itemGroup.getName());

		if ("getItems" in itemGroup) {
			var items = itemGroup.getItems();
		} else if ("getChildItems" in itemGroup) {
			var items = itemGroup.getChildItems();
		}

		for (var i in items) {
			var item = items[i], fulltext = "", filename = "";
			if (item.isRegularItem()) {
				if (!(Zotero.PaperMachines.findItemInDB(item))) {
					queue.add(Zotero.PaperMachines.processItem, itemGroup.getName(), item, dir, i, queue);					
				} else {
					Zotero.PaperMachines.DB.query("INSERT INTO collection_docs (collection,itemID) VALUES (?,?)", [thisGroup, item.id]);
				}
			}
		}

		queue.next();
	},
	getFilenameForItem: function (item) {
		var year = this.getYearOfItem(item);
		year = (year != "" ? year+" - " : "");
		filename = (item.firstCreator != "" ? item.firstCreator + " - " : "");
		filename += year;
		filename += item.getDisplayTitle();
		return Zotero.PaperMachines._sanitizeFilename(filename) + ".txt";
	},
	processItem: function(itemGroupName, item, dir, i, queue) {
		var percentDone = (parseInt(i)+queue.runningTotal)*100.0/queue.grandTotal;
		Zotero.updateZoteroPaneProgressMeter(percentDone);
		var outFile = dir.clone();
		outFile.append(Zotero.PaperMachines.getFilenameForItem(item));

		if (outFile.exists()) {
			Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO collection_docs (collection,itemID) VALUES (?,?)", [dir.leafName, item.id]);			
			queue.runningTotal += 1;
			queue.next();
			return;
		}

		var attachments = item.getAttachments(false);
		var recognizedAttachments = false;
		for (a in attachments) {
			var a_item = Zotero.Items.get(attachments[a]);
			if (a_item.attachmentMIMEType == 'application/pdf'
			   || a_item.attachmentMIMEType == 'text/html') {
			   	recognizedAttachments = true;
				var orig_file = a_item.getFile().path;
				if (orig_file) {
					Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO files_to_extract (filename, itemID, outfile, collection) VALUES (?,?,?,?)", [orig_file, item.id, outFile.path, dir.leafName]);					
				}
			}
		}
		queue.runningTotal += 1;
		queue.next();
	},
	_updateBundledFilesCallback: function (installLocation) {
		this.install_dir = installLocation;
		var xpiZipReader, isUnpacked = installLocation.isDirectory();
		if(!isUnpacked) {
			xpiZipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
					.createInstance(Components.interfaces.nsIZipReader);
			xpiZipReader.open(installLocation);

			var entries = xpiZipReader.findEntries("processors");
			while (entries.hasMore()) {
				var entry = entries.getNext();
				this.LOG(entry);
			}
		} else {
			var procs_dir = installLocation.clone();
			procs_dir.append("chrome");
			procs_dir.append("content");
			procs_dir.append("papermachines");
			procs_dir.append("processors");

			this._copyAllFiles(procs_dir, this.processors_dir);
		}
		this.aux_dir = this._getOrCreateDir("support", this.processors_dir);

		var new_aux = this._getOrCreateDir("support", this.out_dir);
		this._copyAllFiles(this.aux_dir, new_aux);
	},
	_copyOrMoveAllFiles: function (copy_or_move, source, target, recursive) {
		var files = source.directoryEntries;
		while (files.hasMoreElements()) {
			var f = files.getNext().QueryInterface(Components.interfaces.nsIFile);
			if (f.isFile()) {
				var destFile = target.clone();
				destFile.append(f.leafName);
				if (destFile.exists() && f.lastModifiedTime > destFile.lastModifiedTime) { // overwrite old versions
					destFile.remove(false);
				}
				if (copy_or_move) {
					f.copyTo(target, f.leafName);
					if (f.leafName.indexOf(".pyw") != -1) {
						var regpy = f.leafName.replace(".pyw", ".py");
						f.copyTo(target, regpy);
					}
				} else {
					f.moveTo(target, f.leafName);
				}
			} else if (f.isDirectory() && recursive !== false) {
				var newtarget = this._getOrCreateDir(f.leafName, target);
				this._copyOrMoveAllFiles(copy_or_move, f, newtarget, recursive);
			}
		}
	},
	_copyAllFiles: function (source, target, recursive) {
		this._copyOrMoveAllFiles(true, source, target, recursive);
	},
	_moveAllFiles: function (source, target, recursive) {
		this._copyOrMoveAllFiles(false, source, target, recursive);
	},
	_getProcessParams: function (processPath) {
		return Zotero.PaperMachines.DB.rowQuery(Zotero.PaperMachines.processQuery, [processPath]);
	},
	_generateProgressPage: function (processResult) {
		var thisGroup = Zotero.PaperMachines.getGroupByID(processResult["collection"]);

		var iterations = false;

		try {
			var progTextFile = Zotero.PaperMachines._getLocalFile(processResult["progressfile"].replace(".html",".txt"));
			var prog_str = Zotero.File.getContents(progTextFile);
			var iterString = prog_str.match(/(?:<)\d+/g);
			iterations = parseInt(iterString.slice(-1)[0].substring(1));
		} catch (e) { Zotero.PaperMachines.LOG(e.name +": " + e.message);}


		var collectionName = thisGroup.name || thisGroup.getName();
		var progbar_str = '<html><head><meta http-equiv="refresh" content="2;URL=' + 
			"'zotero://papermachines/" + processResult["process_path"] + "'" + '"/></head><body>';
			try {
				progbar_str += '<div>' + Zotero.PaperMachines.processNames[processResult["processor"]] + ': ' + collectionName + '</div>';
			} catch (e) {
				progbar_str += '<div>' + collectionName + '</div>';
			}
			if (iterations) {
				progbar_str += '<progress id="progressBar" max="1000" value="';
				progbar_str += iterations.toString();
				progbar_str += '"/>';
			} else {
				progbar_str += '<progress id="progressBar"/>';
			}
			progbar_str += '</body></html>';
		return progbar_str;
	},
	getThisGroupID: function () {
		return Zotero.PaperMachines.getItemGroupID(ZoteroPane.getItemGroup());
	},
	activateMenuItems: function (thisID) {
		var active = this.hasBeenExtracted(thisID);
		var ids = Zotero.PaperMachines.processors.concat(["reset-output"]);
		ids.forEach(function (d) {
			ZoteroPane.document.getElementById(d).disabled = !active;
		});

		// var highlightFunctions = ["mallet", "geodict"];
		// highlightFunctions.forEach(function (d) {
		// 	var elem = ZoteroPane.document.getElementById(d+"-highlight");
		// 	if (elem) {
		// 		elem.disabled = !Zotero.PaperMachines.hasBeenProcessed(thisID, d);
		// 	}
		// });
	},
	exportOutput: function () {
		var thisGroup = ZoteroPane.getItemGroup();
		var thisID = Zotero.PaperMachines.getItemGroupID(thisGroup);
		var collectionName = thisGroup.name || thisGroup.getName();

		var export_dir = this.filePrompt("export_dir", "getfolder");
		if (export_dir) {
			var query = "SELECT processor, outfile FROM processed_collections " +
				"WHERE status = 'done' AND processor != 'extract' AND collection = ?;";
			var processes = this.DB.query(query, [thisID]);
			var options = [];
			for (var i in processes) {
				var processResult = processes[i],
					process = processResult["processor"],
					outfile = processResult["outfile"];
				options.push({"name": this.processNames[process], "label": " ", "value": outfile});
			}
			var export_processes = Zotero.PaperMachines.selectFromOptions("export_processes", options, "multiplecheck");
			if (export_processes && export_processes.length > 0) {
				var new_dir = this._getOrCreateDir(collectionName + " visualizations", export_dir);
				var new_aux = this._getOrCreateDir("support", new_dir);
				this._copyAllFiles(this.aux_dir, new_aux);
				for (var i in export_processes) {
					var file = Zotero.PaperMachines._getLocalFile(export_processes[i]);
					file.copyTo(new_dir, file.leafName);
				}
			}
		}
	},
	resetOutput: function () {
		if (Zotero.PaperMachines.yesNoPrompt("resetOutput")) {
			var thisID = this.getThisGroupID();
			var files = this.out_dir.directoryEntries;
			while (files.hasMoreElements()) {
				var f = files.getNext().QueryInterface(Components.interfaces.nsIFile);
				if (f.leafName.indexOf(thisID + ".html") != -1 || f.leafName.indexOf(thisID + "progress.html") != -1) {
					f.remove(false);
				}
			}
			Zotero.PaperMachines.DB.query("DELETE FROM processed_collections WHERE collection=?;", [thisID]);
		}
	},
	search: function (str) { 
		var s = new Zotero.Search();
		s.addCondition("quicksearch-everything", "contains", str);
		return s.search();
	},
	filePrompt: function(prompt, mode, filters) {
		const nsIFilePicker = Components.interfaces.nsIFilePicker;

		var fp_mode;
		switch (mode) {
			case "save":
				fp_mode = nsIFilePicker.modeSave;
				break;
			case "getfolder":
				fp_mode = nsIFilePicker.modeGetFolder;
				break;
			case "multi":
				fp_mode = nsIFilePicker.modeOpenMultiple;
				break;
			case "open":
			default:
				fp_mode = nsIFilePicker.modeOpen;
		}
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		fp.init(window, Zotero.PaperMachines.prompts[prompt], fp_mode);
		if (filters) {
			for (var i in filters) {
				fp.appendFilter(i, filters[i]);
			}			
		} else {
			fp.appendFilters(nsIFilePicker.filterAll)
		}
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			switch (mode) {
				case "multi":
					var files = fp.files;
					var paths = [];
					while (files.hasMoreElements()) 
					{
						var arg = files.getNext().QueryInterface(Components.interfaces.nsILocalFile).path;
						paths.push(arg);
					}
					return paths;
					break;
				case "getfolder":
					return fp.file;
				case "open":
				case "save":
				default:
					return [fp.file.path];
			}
		}
	},
	argsHash: function (args_str) {
		return Zotero.PaperMachines.hashCode(args_str);
	},
	hashCode: function (str) {
		var r = 0;
		for (var i = 0; i < str.length; i++) {
			r = (r << 5) - r + str.charCodeAt(i);
			r &= r;
		}
		if (r < 0) {
			r = r + 0xFFFFFFFF + 1;
		}
		return r.toString(16);
	},
	selectFromOptions: function(prompt, options, multiple) {
		var type = "select";
		if (multiple) type = multiple;
		var params = {"dataIn": {"type": type, "prompt": Zotero.PaperMachines.prompts[prompt], "options": options}, "dataOut": null};
		
		return Zotero.PaperMachines._promptWithParams(params);
	},
	selectStoplist: function (lang) {
		var stopfile = Zotero.PaperMachines._getOrCreateFile("stopwords_" + lang + ".txt", Zotero.PaperMachines.processors_dir);
		stopfile.copyTo(Zotero.PaperMachines.processors_dir, "stopwords.txt");
	},
	textPrompt: function(prompt, default_text) {
		if (!default_text) var default_text = "";
		var params = {"dataIn": {"type": "text", "default": default_text, "prompt": Zotero.PaperMachines.prompts[prompt]}, "dataOut": null};
		return Zotero.PaperMachines._promptWithParams(params);
	},
	yesNoPrompt: function(prompt) {
		var params = {"dataIn": {"type": "yes-no", "prompt": Zotero.PaperMachines.prompts[prompt]}, "dataOut": null};
		return Zotero.PaperMachines._promptWithParams(params);
	},
	_promptWithParams: function(params) {
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");

		win.openDialog("chrome://papermachines/content/dialog.xul", "", "chrome, dialog, modal", params);

		if (params.dataOut != null) {
			return params.dataOut;
		} else {
			return false;
		}
	},
	LOG: function(msg) {
	  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
									 .getService(Components.interfaces.nsIConsoleService);
	  consoleService.logStringMessage(msg);
	  Zotero.debug(msg);
	},
	getStringsFromBundle: function () {
		var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
		Zotero.PaperMachines.bundle = stringBundleService.createBundle("chrome://papermachines/locale/papermachines.properties");
		var enumerator = Zotero.PaperMachines.bundle.getSimpleEnumeration();
		Zotero.PaperMachines.bundleStrings = {};
		while (enumerator.hasMoreElements()) {
			var property = enumerator.getNext().QueryInterface(Components.interfaces.nsIPropertyElement);
			Zotero.PaperMachines.bundleStrings[property.key] = property.value;
			var nameParts = property.key.split(".");
			if (nameParts.length == 2 && Zotero.PaperMachines.hasOwnProperty(nameParts[0])) {
				if (!Zotero.PaperMachines[nameParts[0]]) {
					Zotero.PaperMachines[nameParts[0]] = {};
				}
				Zotero.PaperMachines[nameParts[0]][nameParts[1]] = property.value;
			}
		}
	},
	openWindowOrTab: function(url) {
		if (Zotero.isStandalone) {
			window.open(url);
		} else {
			var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");
			win.gBrowser.selectedTab = win.gBrowser.addTab(url);			
		}
	},
	evtListener: function (evt) {
		var node = evt.target, doc = node.ownerDocument;

		var query = node.getAttribute("query");
		if (query) {
			node.setUserData("response", JSON.stringify(Zotero.PaperMachines.search(query)), null);
			var listener = doc.createEvent("HTMLEvents");
			listener.initEvent("papermachines-response", true, false);
			node.dispatchEvent(listener);
		}
	}
};

Zotero.PaperMachines.processObserver = function (processName, processPath, callback) {
  this.processName = processName;
  this.processPath = processPath;
  this.callback = callback;
  this.register();
};

Zotero.PaperMachines.processObserver.prototype = {
  observe: function(subject, topic, data) {
	switch (topic) {
		case "process-failed":
			Zotero.PaperMachines.LOG("Process " + this.processName + " failed.")
			this.callback(false);
			break;
		case "process-finished":
			Zotero.PaperMachines.LOG("Process " + this.processName + " finished.")
			this.callback(true);
			break;
	}
	this.unregister();
  },
  register: function() {
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
						  .getService(Components.interfaces.nsIObserverService);
	observerService.addObserver(this, "process-failed", false);
	observerService.addObserver(this, "process-finished", false);
  },
  unregister: function() {
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
							.getService(Components.interfaces.nsIObserverService);
	observerService.removeObserver(this, "process-failed");
	observerService.removeObserver(this, "process-finished");
  }
}


Zotero.PaperMachines._Sequence = function (onDone) {
	this.list = [];
	this.onDone = onDone;
	this.closeTimer = null;
	this.runningTotal = 1;
	this.grandTotal = 1;
};

Zotero.PaperMachines._Sequence.prototype = {
	startCloseTimer: function () {
		this.closeTimer = setTimeout(this.onDone, 5000);
	},
	belayCloseTimer: function () {
		clearTimeout(this.closeTimer);
	},
	add: function() { 
		var args = Array.prototype.slice.call(arguments);
		this.list.push(args);
	},
	next: function(before) { 
		var my = this;
		if (typeof before == "function") before();
		setTimeout(function () {
			if (my.list.length > 0) {
				my.belayCloseTimer();
				var current = my.list.shift();
				(current.shift()).apply(this, current);
			} else {
				my.startCloseTimer();
			}
		}, 20);
	}
};

window.addEventListener('load', function(e) { Zotero.PaperMachines.init(); }, false);
window.addEventListener("papermachines-request", function (e) { Zotero.PaperMachines.evtListener(e); }, false, true);