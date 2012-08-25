Zotero.PaperMachines = {
	DB: null,
	schema: {
		'doc_files': "CREATE TABLE doc_files (itemID INTEGER PRIMARY KEY, filename VARCHAR(255));",
		'doc_places': "CREATE TABLE doc_places (itemID INTEGER, place INTEGER, FOREIGN KEY(itemID) REFERENCES doc_files(itemID), FOREIGN KEY(place) REFERENCES places(id), UNIQUE(itemID, place) ON CONFLICT IGNORE);",
		'collections': "CREATE TABLE collections (id INTEGER PRIMARY KEY, parent VARCHAR(255), child VARCHAR(255), FOREIGN KEY(parent) REFERENCES collection_docs(collection), FOREIGN KEY(child) REFERENCES collection_docs(collection), UNIQUE(parent, child) ON CONFLICT IGNORE);",
		'collection_docs': "CREATE TABLE collection_docs (id INTEGER PRIMARY KEY, collection VARCHAR(255), itemID INTEGER, FOREIGN KEY(itemID) REFERENCES doc_files(itemID));",
		'places': "CREATE TABLE places (id INTEGER PRIMARY KEY, name VARCHAR(255), lat NUMERIC, lng NUMERIC);",
		'processed_collections': "CREATE TABLE processed_collections (id INTEGER PRIMARY KEY, process_path VARCHAR(255), collection VARCHAR(255), processor VARCHAR(255), status VARCHAR(255), progressfile VARCHAR(255), outfile VARCHAR(255), lastModified DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(collection) REFERENCES collection_docs(collection), UNIQUE(process_path) ON CONFLICT REPLACE);"
	},
	processQuery: "SELECT * FROM processed_collections WHERE process_path = ?;",
	pm_dir: null,
	csv_dir: null,
	out_dir: null,
	log_dir: null,
	install_dir: null,
	tagCloudReplace: true,
	processors_dir: null,
	processors: ["wordcloud", "largewordcloud", "phrasenet", "mallet", "mallet_classify", "geoparse", "dbpedia"],
	processNames: {"wordcloud": "Word Cloud",
		"largewordcloud": "Word Cloud",
		"phrasenet": "Phrase Net",
		"geoparse": "Geoparser",
		"mallet_lda": "Topic Modeling",
		"mallet_lda_categorical": "Topic Modeling",
		"mallet_train-classifier": "Classifier Training",
		"mallet_classify-file": "Classifier Testing",
		"dbpedia": "DBpedia Annotation"
	},
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
			return Zotero.PaperMachines.selectFromOptions(classifiers);
		}
	},
	communicationObjects: {},
	noTagsString: "",

	SCHEME: "zotero://papermachines",

	channel: {
		INTERFACE_URI: "chrome://papermachines/content/processors/aux/nowordcloud.html",
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
					file1.append(pathParts.slice(-1)[0]);					

					if (file1.exists()) {
						file = file1;
					} else {
						var processResult = Zotero.PaperMachines.DB.rowQuery(Zotero.PaperMachines.processQuery, [path]);
						if (processResult) {
							switch (processResult["status"]) {
								case "done":
									file = Components.classes["@mozilla.org/file/local;1"]
										.createInstance(Components.interfaces.nsILocalFile);
									file.initWithPath(processResult["outfile"]);
									if (!file.exists()) {
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
		this.out_dir = this._getOrCreateDir("out");
		this.processors_dir = this._getOrCreateDir("processors");
		this.log_dir = this._getOrCreateDir("logs", this.out_dir);

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

		win.setTimeout(Zotero.PaperMachines.replaceOnCollectionSelected, 5000);

		// ZoteroPane.addReloadListener(function () {
		// 	setTimeout(Zotero.PaperMachines.replaceOnCollectionSelected, 5000);		
		// });
	},
	extractText: function () {
		var itemGroup = ZoteroPane.getItemGroup();
		var queue = new Zotero.PaperMachines._Sequence(function() {
			Zotero.hideZoteroPaneOverlay();
			Zotero.UnresponsiveScriptIndicator.enable();
		});

		Zotero.UnresponsiveScriptIndicator.disable();

		queue.grandTotal = Zotero.PaperMachines.countItemsInGroup(itemGroup) || 1000;

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
			if (prompt_result) additional_args.push(prompt_result);
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
		var collectionName = thisGroup.getName();

		if (Zotero.PaperMachines._checkIfRunning(processPath)) {
			return;
		}

		var proc_file = Zotero.PaperMachines.processors_dir.clone();
		proc_file.append(processor + ".py");

		var proc = Components.classes["@mozilla.org/process/util;1"]
			.createInstance(Components.interfaces.nsIProcess);

		var csv = Zotero.PaperMachines.buildCSV(thisGroup);

		var progressFile = Zotero.PaperMachines._getOrCreateFile(processor + thisID + "progress.html", Zotero.PaperMachines.out_dir);
		var outFile = Zotero.PaperMachines.out_dir.clone();

		var additional_args_str = additional_args.length > 0 ? "_" + encodeURIComponent(additional_args.join("_")) : "";
		outFile.append(processor + thisID + additional_args_str + ".html");

		var sql = "INSERT OR REPLACE INTO processed_collections (process_path, collection, processor, status, progressfile, outfile) " +
			" values (?, ?, ?, ?, ?, ?);";
		Zotero.PaperMachines.DB.query(sql, [processPath, thisID, processor, "running", progressFile.path, outFile.path]);

		var args = [Zotero.PaperMachines.processors_dir.path, csv.path, Zotero.PaperMachines.out_dir.path, collectionName];

		args = args.concat(additional_args);

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
		proc.runAsync(args, args.length, observer);
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
	buildCSV: function(collection) {
		var id = this.getItemGroupID(collection);
		if (!id) return false;

		var csv_file = this.csv_dir.clone();
		csv_file.append(id + ".csv");
		if (!csv_file.exists()) {
			csv_file.create(Components.interfaces.nsIFile.FILE_TYPE, 0644);
		}

		var csv_str = "";
		var header = ["filename","itemID", "title", "label", "key","year","place"];
		csv_str += header.join(",") + "\n";

		var query = "SELECT itemID, filename FROM doc_files WHERE itemID IN " +
					"(SELECT itemID FROM collection_docs WHERE collection = ? OR collection IN " +
					"(SELECT child FROM collections WHERE parent = ?));";

		var docs = this.DB.query(query, [id, id]);

		if (!docs) return false;

		for (var i in docs) {
			var row = [];
			var item = Zotero.Items.get(docs[i]["itemID"]);
			for (var k in header) {
				var val;
				if (header[k] in docs[i]) {
					val = docs[i][header[k]];
				} else if (header[k] == "year") {
					val = this.getYearOfItem(item);
				} else if (header[k] == "place") {
					val = this.getPlaceOfItem(item);
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
			if (itemGroup.isCollection()) {
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
		itemGroups.push(itemGroup);
		if (itemGroup.isCollection()) {
			var currentCollection = ("ref" in itemGroup) ? itemGroup.ref : itemGroup;
			if (currentCollection.hasChildCollections()) {
				var children = currentCollection.getChildCollections();
				for (var i in children) {
					itemGroups.push(Zotero.PaperMachines.traverseItemGroup(children[i]));
				}
			}
		} else if (itemGroup.isGroup()) {
			if (itemGroup.ref.hasCollections()) {
				var children = itemGroup.ref.getCollections();
				for (var i in children) {
					itemGroups.push(Zotero.PaperMachines.traverseItemGroup(children[i]));
				}				
			}
		} else if (itemGroup.isLibrary()) {
			// TODO
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
		if (!location) {
			this.locateItem(items[0]);
		}
		alert(location);
	},
	getPlaceOfItem: function (item) {
		return this.DB.valueQuery("SELECT place FROM doc_places WHERE itemID = ?;", [item.id]) || item.getField("place");
	},
	getYearOfItem: function (item) {
		return item.getField("date", true, true).substring(0,4);
	},
	getCollectionOfItem: function (item) {
		return this.DB.valueQuery("SELECT collection FROM collection_docs WHERE itemID = ?;", [item.id]);
	},
	findItemInDB: function (item) {
		return this.DB.valueQuery("SELECT COUNT(*) FROM doc_files WHERE itemID = ?;",[item.id]);
	},
	countItemsInGroup: function (itemGroup) {
		var count = 0;
		var query = "SELECT COUNT(DISTINCT itemID) FROM collectionItems WHERE collectionID = ?" +
			" AND itemID in (SELECT sourceItemID FROM itemAttachments WHERE " +
			"mimeType = 'application/pdf' OR mimeType = 'text/html');";
		this.processItemGroup(itemGroup, function (itemGroup) {
			if (itemGroup.isCollection()) {
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
		if (typeof itemGroup.isCollection === "function" && itemGroup.isCollection()) {
			if (itemGroup.hasOwnProperty("ref")) {
				return (itemGroup.ref.libraryID != null ? itemGroup.ref.libraryID.toString() : "") + "C" + itemGroup.ref.id.toString();				
			} else {
				return (itemGroup.libraryID != null ? itemGroup.libraryID.toString() : "") + "C" + itemGroup.id.toString();								
			}
		} else if (typeof itemGroup.isGroup === "function" && itemGroup.isGroup()) {
			return itemGroup.ref.libraryID;
		} else {
			return itemGroup.id;
		}
	},
	getGroupByID: function (id) {
		if (id.indexOf("C") != -1) {
			return Zotero.Collections.get(id.split("C")[1]);
		}
	},
	getNameOfGroup: function (id) {
		try {
			return Zotero.PaperMachines.getGroupByID(id).getName();		
		}
		catch (e) { return false; }
	},
	extractFromItemGroup: function (itemGroup, queue) {
		var dir = Zotero.PaperMachines._getOrCreateDir(Zotero.PaperMachines.getItemGroupID(itemGroup));
		// Zotero.showZoteroPaneProgressMeter(itemGroup.getName());

		if ("getItems" in itemGroup) {
			var items = itemGroup.getItems();
		} else if ("getChildItems" in itemGroup) {
			var items = itemGroup.getChildItems();
		}

		for (var i in items) {
			var item = items[i], fulltext = "", filename = "";
			if (item.isRegularItem() && !(Zotero.PaperMachines.findItemInDB(item))) {
				queue.add(Zotero.PaperMachines.processItem, itemGroup.getName(), item, dir, i, queue);
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
		Zotero.showZoteroPaneProgressMeter(itemGroupName, true);
		var percentDone = (parseInt(i)+queue.runningTotal)*100.0/queue.grandTotal;
		var outFile = dir.clone();
		outFile.append(Zotero.PaperMachines.getFilenameForItem(item));

		if(outFile.exists()) {
			Zotero.updateZoteroPaneProgressMeter(percentDone);
			queue.runningTotal += 1;
			queue.next();
			return;
		}

		var fulltext = "";

		var attachments = item.getAttachments(false);
		for (a in attachments) {
			var a_item = Zotero.Items.get(attachments[a]);
			if (a_item.attachmentMIMEType == 'application/pdf'
			   || a_item.attachmentMIMEType == 'text/html') {
				fulltext += a_item.attachmentText;
			}
		}
		if (fulltext != "") {
			Zotero.File.putContents(outFile, fulltext);
			var itemExists = Zotero.PaperMachines.findItemInDB(item);

			Zotero.PaperMachines.DB.beginTransaction();
			if (itemExists == false) {
				Zotero.PaperMachines.DB.query("INSERT INTO doc_files (itemID, filename) VALUES (?,?)", [item.id, outFile.path]);
			}
			Zotero.PaperMachines.DB.query("INSERT INTO collection_docs (collection,itemID) VALUES (?,?)", [dir.leafName, item.id]);

			Zotero.PaperMachines.DB.commitTransaction();

		}
		Zotero.updateZoteroPaneProgressMeter(percentDone);
		queue.runningTotal += 1;
		queue.next();
	},
	locateItem: function(item) {
		var placename = item.getField("place");
		placename = placename.replace(/[^\w, ]/g, '')

		var place_id = this.DB.valueQuery("SELECT id FROM places WHERE name = ?", [placename]);
		if (place_id) {
			if (this.DB.valueQuery("SELECT COUNT(*) FROM doc_places WHERE itemID = ?;", [item.id]) > 0) {
				return;
			} else {
				this.DB.query("INSERT INTO doc_places (itemID, place) VALUES (?, ?);", [item.id, place_id]);
				return;
			}
		} else {
			// see https://github.com/schuyler/zotero-maps/blob/master/chrome/content/zotero-maps/setup.js


			// var url = "http://zotero.ws.geonames.org/search?q=";
			// url += encodeURIComponent(placename);
			// url += "&maxRows=1&type=json";
			// Zotero.HTTP.doGet(url, function (xmlhttp) {
			// 	if (xmlhttp.status == 200) {
			// 		var json = JSON.parse(xmlhttp.responseText);
			// 		var geoname;
			// 		if(json && json.totalResultsCount > 0) {
			// 			geoname = json.geonames[0];
			// 			/* Store the geonames result in the cache for later reuse.
			// 			 * The geonames service may return a different place name than
			// 			 * the one given; if so, cache that, too. */

			// 			place_id = Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO places (name, lng, lat) values (?, ?, ?);", [placename, geoname.lng, geoname.lat]);
			// 			if (geoname.name != placename) {
			// 				Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO places (name, lng, lat) values (?, ?, ?);", [geoname.name, geoname.lng, geoname.lat]);
			// 			}
			// 		} else {
			// 			place_id = Zotero.PaperMachines.DB.query("INSERT OR IGNORE INTO places (name, lng, lat) values (?, ?, ?);", [placename, 0.0, 0.0]);
			// 		}
			// 	}
			// });
		}
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
		this.aux_dir = this.processors_dir.clone();
		this.aux_dir.append("aux");
		this._moveAllFiles(this.aux_dir, this.out_dir);
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
			var progTextFile = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			progTextFile.initWithPath(processResult["progressfile"].replace(".html",".txt"))

			var prog_str = Zotero.File.getContents(progTextFile);
			var iterString = prog_str.match(/(?:<)\d+/g);
			iterations = parseInt(iterString.slice(-1)[0].substring(1));
		} catch (e) { }


		var collectionName = thisGroup.getName();
		var progbar_str = '<html><head><meta http-equiv="refresh" content="2;URL=' + 
			"'zotero://papermachines/" + processResult["process_path"] + "'" + '"/></head><body>';
			progbar_str += '<div>' + Zotero.PaperMachines.processNames[processResult["processor"]] + ': ' + collectionName + '</div>';
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
	resetOutput: function () {
		var thisID = this.getThisGroupID();
		var files = this.out_dir.directoryEntries;
		while (files.hasMoreElements()) {
			var f = files.getNext().QueryInterface(Components.interfaces.nsIFile);
			if (f.leafName.indexOf(thisID + ".html") != -1 || f.leafName.indexOf(thisID + "progress.html") != -1) {
				f.remove(false);
			}
		}
		Zotero.PaperMachines.DB.query("DELETE FROM processed_collections WHERE collection=?;", [thisID]);
	},
	search: function (str) { 
		var s = new Zotero.Search();
		s.addCondition("quicksearch-everything", "contains", str);
		return s.search();
	},
	selectFromOptions: function(options) {
		var params = {"dataIn": options, "dataOut": null};
		
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