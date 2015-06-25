var EttReplyRobot = {
  DB_FILE_NAME: "ettreplyrobot.sqlite",
  DB_TABLE_NAME: "user_define_text",
  DB_TABLE_NAME_V2: "user_define_text_v2",
  DB_TABLE_FIELD: "userText TEXT, ctrl INTEGER, alt INTEGER, shift INTEGER, key INTEGER, type INTEGER, rcv INTEGER",
  DB_TABLE_FIELD_V2: "userText TEXT, ctrl INTEGER, alt INTEGER, shift INTEGER, key INTEGER, type INTEGER, global INTEGER, rcv INTEGER",
  dirSvc_ : Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,
  keyCodeMapping : null,
  charCodeMappingMac : null,
  OS : Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS,
  allKeys_: {},
  globalKeys_: {},
  httpKeys_: {},
  telnetKeys_: {},
  /*
  prefs : Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefService)
                 .getBranch("extensions.ettreplyrobot.options."),
  */
  httpCheck : /(^https?:\/\/)/i,
  tempInput: null,
  telnetCheck : /(^telnet:\/\/)/i,
  sshCheck : /(^ssh:\/\/)/i,
  tempText: null,

  EttReplyRobotLoad: function(_this) {
    _this.prefListener = new EttReplyRobot.PrefListener('extensions.ettreplyrobot.options.', function(branch, name) {EttReplyRobot.onPrefChange(EttReplyRobot, branch, name);});
    _this.prefListener.register();
    _this.item_getFocus={
        view: this,
        handleEvent: function(e) {
          if(e.target && e.target.tagName)
          {
            var tn = e.target.tagName.toLowerCase();
            if( tn == 'input' || tn == 'textarea' || tn == 'textbox')
              _this.tempInput = e.target;
          }
        }
    };

    _this.key_press ={
      view: this,
      handleEvent: function(event) {
        var km = 0;
        if(event.keyCode && event.keyCode==13 && event.ctrlKey && !event.altKey && !event.shiftKey && EttReplyRobot.tempInput)
        {
          EttReplyRobot.insertText();
          event.stopPropagation();
          event.preventDefault();
          //d o c u m e n t.p o p u p N o d e = EttReplyRobot.tempInput;
          //var e = event;
          //var contextMenu = new nsContextMenu(e.view.document, gBrowser);
        } else {
          if(event.keyCode)
          {
            km = _this.keyCodeMapping['k'+event.keyCode];
          }
          else if(event.charCode)
          {
            if(event.altKey && !event.ctrlKey && _this.charCodeMappingMac)
              km = _this.charCodeMappingMac['c'+event.charCode];
            else
              km = _this.charCodeMapping['c'+event.charCode];
          }

          if(km)
          {
          	var keySet = {
          		ctrl: event.ctrlKey,
          		alt: event.altKey,
          		shift: event.shiftKey,
          		km: km
          	};
          	if(EttReplyRobot.insertText( keySet )) {
              event.stopPropagation();
              event.preventDefault();
            }
            //EttReplyRobot.sendStrByHotkey(event.ctrlKey, event.altKey, event.shiftKey, km);
          }
        }
      }
    };
    gBrowser.mPanelContainer.addEventListener("keypress", _this.key_press, true);
    gBrowser.mPanelContainer.addEventListener('focus', _this.item_getFocus, true);
    document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", EttReplyRobot.contextMenuShowing, false);
    _this.charCodeMapping = window.CharCodeMapping;
    _this.keyCodeMapping = window.KeyCodeMapping;
    if(_this.OS=='Darwin')
      _this.charCodeMappingMac = window.CharCodeMappingMac;
    var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    timer.initWithCallback({ notify: function(timer) { EttReplyRobot.loadHotkeyData(); } }, 10, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },

  EttReplyRobotUnload: function(_this) {
  	_this.prefListener.unregister();
    gBrowser.mPanelContainer.removeEventListener("keypress", _this.key_press, true);
    gBrowser.mPanelContainer.removeEventListener('focus', _this.item_getFocus, true);
    document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", EttReplyRobot.contextMenuShowing, false);
  },

  contextMenuShowing: function(e) {
    var _this = EttReplyRobot;
    var menuitem = null;
    var menuitemPaste = null;
    if (gBrowser && gBrowser.currentURI){
      var urlstr = gBrowser.currentURI.spec;
      if(_this.telnetCheck.test(urlstr) || _this.sshCheck.test(urlstr)) //telnet or ssh
      {
        menuitem = document.getElementById("ettreplyrobot_menu-insertText");
        if(menuitem)
          menuitem.hidden = false;
        return;
      }
    }

    menuitemPaste = document.getElementById("context-paste");
    menuitem = document.getElementById("ettreplyrobot_menu-insertText");
    if(menuitemPaste && menuitem)
      menuitem.hidden = menuitemPaste.hidden;
  },

  getStrByHotkey: function(ctrl, alt, shift, km) {
  	var m = '';
    m+=( ctrl  ? '1' : '0' );
    m+=( alt   ? '1' : '0' );
    m+=( shift ? '1' : '0' );
    m+=String(km);
    if(this.allKeys_[m]) {
      var retVals = {};
      retVals.selectedText = this.allKeys_[m].text;
      retVals.type = this.allKeys_[m].type;
      
      if (gBrowser && gBrowser.currentURI){
        var urlstr = gBrowser.currentURI.spec;
        if(this.telnetCheck.test(urlstr) || this.sshCheck.test(urlstr))
        {
        	if(this.telnetKeys_[m])
        	  return retVals;
        	else
        		return null;
        }
        else if(this.httpCheck.test(urlstr))
        {
        	if(this.httpKeys_[m])
        	  return retVals;
        	else
        		return null;
        }
        else
        {
        	if(this.globalKeys_[m])
        	  return retVals;
        	else
        		return null;        	
        }
      }
      return retVals;
    }
    return null;
  },
  
  insertText: function(keySet) {
      var retVals = { selectedText: null, type: 0};
      if(keySet) {
      	var rtn = EttReplyRobot.getStrByHotkey(keySet.ctrl, keySet.alt, keySet.shift, keySet.km);
      	if(rtn) {
      	  retVals = rtn;
        } else {
        	return;
        }
      } else {
        const EMURL = "chrome://ettreplyrobot/content/rrTextList.xul";
        const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
        window.openDialog(EMURL, "", EMFEATURES, retVals);
      }
      if(!retVals.selectedText)
        return;

      if (gBrowser && gBrowser.currentURI){
        var urlstr = gBrowser.currentURI.spec;
        if(this.telnetCheck.test(urlstr) || this.sshCheck.test(urlstr)) //telnet ?
        {
          var cmdhandler = gBrowser.contentDocument.getElementById("cmdHandler");
          var obj1 = gBrowser.contentDocument.getElementById("main");
          var obj2 = gBrowser.contentDocument.getElementById("cursor");
          var obj3 = gBrowser.contentDocument.getElementById("hideobj");
          if(cmdhandler && obj1 && obj2 && obj3)
          {
            //for telnet add-on BBSFox 2.0.35 and later
            //https://addons.mozilla.org/zh-TW/firefox/addon/bbsfox/
            var doc = gBrowser.contentDocument;
            //cmdhandler.setAttribute("FireGestureKey", "codestr,c"+retVals.selectedText);
            if(retVals.type==0)
            {
              /*
              var cmd = 'codestr,';
              var strArray = retVals.selectedText.split('\n');
              for(var i=0;i<strArray.length;++i)
              {
                cmd +=('c'+strArray[i]);
                if(i<strArray.length-1)
                  cmd +=(',h0d,');
              }
              cmdhandler.setAttribute("FireGestureKey", cmd);
              */
              cmdhandler.setAttribute("FireGestureKey", "SendTextData");
              cmdhandler.setAttribute("FireGestureKeyEx", retVals.selectedText);
              if ("createEvent" in doc) {
                cmdhandler.setAttribute("bbsfoxCommand", "checkFireGestureKey");
                var evt = doc.createEvent("Events");
                evt.initEvent("OverlayCommand", true, false);
                cmdhandler.dispatchEvent(evt);
                return true;
              }
            }
            else
            {
              cmdhandler.setAttribute("FireGestureKey", "codestr,"+retVals.selectedText);
              if ("createEvent" in doc) {
                cmdhandler.setAttribute("bbsfoxCommand", "checkFireGestureKey");
                var evt = doc.createEvent("Events");
                evt.initEvent("OverlayCommand", true, false);
                cmdhandler.dispatchEvent(evt);
                return true;
              }
            }
          }
          else //other telnet add-on ?
          {
            var input_proxy = gBrowser.contentDocument.getElementById("input_proxy");
            var obj4 = gBrowser.contentDocument.getElementById("canvas");
            var obj5 = gBrowser.contentDocument.getElementById("topwin");
            var obj6 = gBrowser.contentDocument.getElementById("BBSWin");
            if(input_proxy && obj4 && obj5 && obj6)
            {
              //for telnet add-on pcmanfx-unofficial
              //https://addons.mozilla.org/zh-TW/firefox/addon/pcman-bbs-extension/
              var strArray = retVals.selectedText.split('\n');
              for(var i=0;i<strArray.length;++i)
              {
                input_proxy.value = strArray[i];
                EttReplyRobot.sendEvent(1);
                if(i<strArray.length-1)
                  EttReplyRobot.sendEvent(4);
              }
              return true;
            }
            else if(input_proxy && obj4 && obj5)
            {
              //for telnet add-on PCMan BBS Extension 0.2.5
              //https://addons.mozilla.org/zh-TW/firefox/addon/pcman-bbs-extension/
              var strArray = retVals.selectedText.split('\n');
              for(var i=0;i<strArray.length;++i)
              {
                input_proxy.value = strArray[i];
                EttReplyRobot.sendEvent(1);
                if(i<strArray.length-1)
                  EttReplyRobot.sendEvent(2);
              }
              return true;
            }
            else
            {
              //other add-on, ex: fireBBS
              //https://addons.mozilla.org/zh-TW/firefox/addon/firebbsl-hedgehog/
              //NOT support yet
            }
            return;
          }
        }
      }
      //for web page
      var newPost = this.tempInput.selectionStart + retVals.selectedText.length;
      var preStr = this.tempInput.value.substr(0,this.tempInput.selectionStart);
      var postStr = this.tempInput.value.substr(this.tempInput.selectionEnd,this.tempInput.value.length);
      this.tempInput.value = preStr + retVals.selectedText + postStr;
      this.tempInput.selectionStart = newPost;
      this.tempInput.selectionEnd = newPost;
      return true;
  },

  isTargetATextBox: function(node) {
    if (node instanceof HTMLInputElement)
      return node.mozIsTextField(false);

    return (node instanceof HTMLTextAreaElement);
  },

  sendEvent: function(type) {
    var doc = gBrowser.contentDocument;
    if ("createEvent" in doc) {      
      if(type==1) //input event to pcmanfx's textbox
      {
      	var evt = doc.createEvent("UIEvents");
        var input_proxy = gBrowser.contentDocument.getElementById("input_proxy");
        evt.initUIEvent("input", true, true, document.commandDispatcher.focusedWindow, 0);
        input_proxy.dispatchEvent(evt);
      }
      else if(type==2)//keypress event to pcmanfx's window
      {
      	var evt = doc.createEvent("UIEvents");
        evt.initUIEvent("keypress", false, true, document.commandDispatcher.focusedWindow, 0);
        evt.keyCode = 13;
        evt.ctrlKey = false;
        evt.altKey = false;
        evt.shiftKey = false;
        evt.metaKey = false;
        evt.which = 13;
        evt.charCode = 0;
        document.commandDispatcher.focusedWindow.dispatchEvent(evt);
      }
      else if(type==4)//keypress event to pcmanfx/fireBBS window
      {
        var evt = doc.createEvent("UIEvents");
        var input_proxy = gBrowser.contentDocument.getElementById("input_proxy");
        evt.initUIEvent("keypress", false, true, document.commandDispatcher.focusedWindow, 0);
        evt.keyCode = 13;
        evt.ctrlKey = false;
        evt.altKey = false;
        evt.shiftKey = false;
        evt.metaKey = false;
        evt.which = 13;
        evt.charCode = 0;
        input_proxy.dispatchEvent(evt);
      }
    }
  },

  getDBFile: function () {
    if(!this.dbFile_)
    {
      this.dbFile_ = this.dirSvc_.get("ProfD", Components.interfaces.nsIFile);
      this.dbFile_.append(this.DB_FILE_NAME);
    }
    return this.dbFile_;
  },
  
  getDBConnection: function (aForceOpen) {
  	this.getDBFile();
    if (!aForceOpen && !this.dbFile_.exists())
      return null;
    if (!this.dbConn_ || !this.dbConn_.connectionReady) {
      var dbSvc = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
      this.dbConn_ = dbSvc.openDatabase(this.dbFile_);
    }
    return this.dbConn_;
  },

  getTableVersion: function(dbConn) {
    if(dbConn.tableExists(this.DB_TABLE_NAME))
      return 1;
    else if(dbConn.tableExists(this.DB_TABLE_NAME_V2))
      return 2;
    return 0;
  },
  
  transV1toV2: function(dbConn) {
    dbConn.createTable(this.DB_TABLE_NAME_V2, this.DB_TABLE_FIELD_V2);
    dbConn.beginTransaction();
    var stmt = dbConn.createStatement("SELECT * FROM "+this.DB_TABLE_NAME);
    try {
      while (stmt.executeStep())
      {
        //var idx     = stmt.getInt32(0);
        var text    = stmt.getUTF8String(0);
        var ctrl    = (stmt.getInt32(1)!=0); //getIsNull
        var alt     = (stmt.getInt32(2)!=0);
        var shift   = (stmt.getInt32(3)!=0);
        var key     = stmt.getInt32(4);
        var type    = stmt.getInt32(5);
        var rcv     = stmt.getInt32(6);
        var stmt2 = dbConn.createStatement("INSERT INTO "+this.DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?)");
        stmt2.bindUTF8StringParameter(0, text);
        stmt2.bindInt32Parameter(1, ctrl ? 1 : 0); //bindNullParameter
        stmt2.bindInt32Parameter(2, alt ? 1 : 0);
        stmt2.bindInt32Parameter(3, shift ? 1 : 0);
        stmt2.bindInt32Parameter(4, key);
        stmt2.bindInt32Parameter(5, type);
        stmt2.bindInt32Parameter(6, 0);
        stmt2.bindInt32Parameter(7, rcv);
        try {
          stmt2.execute();
        }
        catch(ex2) {}
        finally { stmt2.reset(); stmt2.finalize(); }
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }

    dbConn.commitTransaction();
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+this.DB_TABLE_NAME);
  },

  loadHotkeyData: function () {
  	this.allKeys_ = {};
    this.globalKeys_ = {};
    this.httpKeys_ = {};
    this.telnetKeys_ = {};
    var dbConn = this.getDBConnection(false);
    if (!dbConn || this.getTableVersion(dbConn)==0 )
      return false;
    if(this.getTableVersion(dbConn)==1)
      this.transV1toV2(dbConn);

    var stmt = dbConn.createStatement("SELECT * FROM "+this.DB_TABLE_NAME_V2);
    try {
      while (stmt.executeStep())
      {
        var text    = stmt.getUTF8String(0);
        var ctrl    = (stmt.getInt32(1)!=0); //getIsNull
        var alt     = (stmt.getInt32(2)!=0);
        var shift   = (stmt.getInt32(3)!=0);
        var key     = stmt.getInt32(4);
        var type    = stmt.getInt32(5);
        var global  = stmt.getInt32(6);
        var rcv     = stmt.getInt32(7);
        if(global != 0 && key) {
          var m = '';
          m+=( ctrl  ? '1' : '0' );
          m+=( alt   ? '1' : '0' );
          m+=( shift ? '1' : '0' );
          m+=String(key);
          //var newHotkey = new EttReplyRobotText(text, ctrl, alt, shift, key, type, global, rcv);
          var keyObj = {type: type, text: text};
          this.allKeys_[m] = keyObj;
          if(global == 1)
          {
          	this.httpKeys_[m] = keyObj;
          }
          else if(global == 2)
          {
          	this.telnetKeys_[m] = keyObj;
          }
          else if(global == 3)
          {
          	this.globalKeys_[m] = keyObj;
          	this.httpKeys_[m] = keyObj;
          	this.telnetKeys_[m] = keyObj;
          }
        }
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
  },

  PrefListener: function (branchName, func) {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch(branchName);
    branch.QueryInterface(Components.interfaces.nsIPrefBranch);
    this.register = function() {
      branch.addObserver("", this, false);
      branch.getChildList("", { })
        .forEach(function (name) { func(branch, name); });
    };
    this.unregister = function() {
      if (branch)
        branch.removeObserver("", this);
    };
    this.observe = function(subject, topic, data) {
      if (topic == "nsPref:changed")
        func(branch, data);
    };
  },

  onPrefChange: function(_this, branch, name) {
    try {
      switch (name) {
        case "updateSetting":
          //update setting
          _this.loadHotkeyData();
          break;
      }
    } catch(e) {
      // eats all errors
      return;
    }
  }

};

window.addEventListener("load",   function() { EttReplyRobot.EttReplyRobotLoad(EttReplyRobot); },   false);
window.addEventListener("unload", function() { EttReplyRobot.EttReplyRobotUnload(EttReplyRobot); }, false);