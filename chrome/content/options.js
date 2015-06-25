const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const DB_FILE_NAME = "ettreplyrobot.sqlite";
const DB_TABLE_NAME = "user_define_text";
const DB_TABLE_NAME_V2 = "user_define_text_v2";

function EttReplyRobotOptions() {
  this.allTextSetting = [];
}

EttReplyRobotOptions.prototype = {
  dirSvc_ : Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,
  prefs : Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.ettreplyrobot.options."),
              
  getDBConnection: function (aForceOpen) {
    if (!aForceOpen && !this.dbFile_.exists())
      return null;
    if (!this.dbConn_ || !this.dbConn_.connectionReady) {
      var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
      this.dbConn_ = dbSvc.openDatabase(this.dbFile_);
    }
    return this.dbConn_;
  },

  load: function() {
    this.dbFile_ = this.dirSvc_.get("ProfD", Ci.nsIFile);
    this.dbFile_.append(DB_FILE_NAME);
    var dbConn = this.getDBConnection(false);
    if (!dbConn || !dbConn.tableExists(DB_TABLE_NAME_V2))
      return false;

    var list = document.getElementById('TextList');
    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME_V2);
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
        var global  = stmt.getInt32(6);
        var rcv     = stmt.getInt32(7);
        var newText = new EttReplyRobotText(text, ctrl, alt, shift, key, type, global, rcv);
        this.allTextSetting.push(newText);
        this.addTextToList(list, text, newText.getHotkeyText());
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
    if(list.itemCount)
      list.selectedIndex = 0;
    this.updateButtonState();    
    return true;
  },

  save: function(subBranch) {
    var dbConn = this.getDBConnection(true);
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+DB_TABLE_NAME_V2);
    dbConn.createTable(DB_TABLE_NAME_V2, "userText TEXT, ctrl INTEGER, alt INTEGER, shift INTEGER, key INTEGER, type INTEGER, global INTEGER, rcv INTEGER");
    dbConn.beginTransaction();

    for(var i in this.allTextSetting){
      var stmt = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?)");

      stmt.bindUTF8StringParameter(0, this.allTextSetting[i].text);
      stmt.bindInt32Parameter(1, this.allTextSetting[i].ctrl ? 1 : 0); //bindNullParameter
      stmt.bindInt32Parameter(2, this.allTextSetting[i].alt ? 1 : 0);
      stmt.bindInt32Parameter(3, this.allTextSetting[i].shift ? 1 : 0);
      stmt.bindInt32Parameter(4, this.allTextSetting[i].key);
      stmt.bindInt32Parameter(5, this.allTextSetting[i].type);
      stmt.bindInt32Parameter(6, this.allTextSetting[i].global);
      stmt.bindInt32Parameter(7, this.allTextSetting[i].rcv);
      try {
        stmt.execute();
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    dbConn.commitTransaction();
    var t2 = new Date();
    this.prefs.setIntPref("updateSetting", t2.getTime());
  },

  finish: function() {
    if(this.dbConn_)
    {
      this.dbConn_.close();
      this.dbConn_ = null;
    }
  },

  addNewText: function() {
    /*
    var existText = [];
    var list = document.getElementById('TextList');
    for(var i=0;i<list.itemCount;++i)
    {
      var listitem = list.getItemAtIndex(i);
      existText.push(listitem.getAttribute('label'));
    }
    */

    const EMURL = "chrome://ettreplyrobot/content/editTextDlg.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
    var retVals = { exec: false, text: null, ctrl: false, alt: false, shift: false, key: 0, type: 0, global: 0, rcv: 0};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
    if(retVals.exec)
    {
      var list = document.getElementById('TextList');
      var newText = new EttReplyRobotText(retVals.text, retVals.ctrl, retVals.alt, retVals.shift, retVals.key, retVals.type, retVals.global, retVals.rcv);
      this.allTextSetting.push(newText);
      this.addTextToList(list, retVals.text, newText.getHotkeyText());
      // add to database...
      if(list.itemCount==1)
        list.selectedIndex = 0;
      this.updateButtonState();
      return true;
    }
    else
    {
    }
    return false;
  },

  delSelText: function() {
    const EMURL = "chrome://ettreplyrobot/content/confirmDelDlg.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=no, modal=yes, centerscreen";
    var retVals = {exec: false};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
    if(retVals.exec)
    {
      var list = document.getElementById('TextList');
      var idx = list.getIndexOfItem(list.selectedItems[0]);
      var idx2 = 0;
      list.removeItemAt(list.getIndexOfItem(list.selectedItems[0]));

      var temp = [];
      while(this.allTextSetting.length){
        var setting = this.allTextSetting.shift();
        {
          if(idx2 != idx)
            temp.push(setting);
          ++idx2;
        }
      }

      while(temp.length){
        this.allTextSetting.push(temp.shift());
      }

      if(list.itemCount)
      {
        var newIdx = idx;
        if(list.itemCount==newIdx)
          newIdx = list.itemCount-1;
        list.selectedIndex = newIdx;
      }
      this.updateButtonState();
      return true;
    }
    return false;
  },

  modifySelText: function() {
    var list = document.getElementById('TextList');
    var idx = list.getIndexOfItem(list.selectedItems[0]);
    var setting = this.allTextSetting[idx];

    const EMURL = "chrome://ettreplyrobot/content/editTextDlg.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
    var retVals = {exec: false, text: setting.text, ctrl: setting.ctrl, alt: setting.alt, shift: setting.shift, key: setting.key, type: setting.type, global: setting.global, rcv: setting.rcv};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
    if(retVals.exec)
    {
      this.allTextSetting[idx].text  = retVals.text;
      this.allTextSetting[idx].ctrl  = retVals.ctrl;
      this.allTextSetting[idx].alt   = retVals.alt;
      this.allTextSetting[idx].shift = retVals.shift;
      this.allTextSetting[idx].key   = retVals.key;
      this.allTextSetting[idx].type  = retVals.type;
      this.allTextSetting[idx].global= retVals.global;
      this.allTextSetting[idx].rcv   = retVals.rcv;
      this.modifyListText(list, list.getIndexOfItem(list.selectedItems[0]), retVals.text, this.allTextSetting[idx].getHotkeyText());
      return true;
    }
    return false;
  },

  importV1: function(dbConn, list) {
    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME);
    try {
      while (stmt.executeStep())
      {
        var text    = stmt.getUTF8String(0);
        var ctrl    = (stmt.getInt32(1)!=0); //getIsNull
        var alt     = (stmt.getInt32(2)!=0);
        var shift   = (stmt.getInt32(3)!=0);
        var key     = stmt.getInt32(4);
        var type    = stmt.getInt32(5);
        var rcv     = stmt.getInt32(6);
        var newText = new EttReplyRobotText(text, ctrl, alt, shift, key, type, 0, rcv);
        this.allTextSetting.push(newText);
        this.addTextToList(list, text, newText.getHotkeyText());
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
  },

  importV2: function(dbConn, list) {
    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME_V2);
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
        var newText = new EttReplyRobotText(text, ctrl, alt, shift, key, type, global, rcv);
        this.allTextSetting.push(newText);
        this.addTextToList(list, text, newText.getHotkeyText());
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
  },
  
  importText: function() {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, null, nsIFilePicker.modeOpen);
    fp.appendFilter("SQLite", "*.sqlite");
    if (fp.show() == fp.returnCancel || !fp.file) return false;
    if(!fp.file.exists()) return false;

    var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
    var dbConn = dbSvc.openDatabase(fp.file);   
    var list = document.getElementById('TextList');
    if(dbConn.tableExists(DB_TABLE_NAME))
      this.importV1(dbConn, list);
    else if(dbConn.tableExists(DB_TABLE_NAME_V2))
      this.importV2(dbConn, list);

    if(dbConn )
    {
      dbConn.close();
      dbConn = null;
    }
    if(list.itemCount)
      list.selectedIndex = 0;
    this.updateButtonState();
    return true;
  },

  exportText: function() {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, null, nsIFilePicker.modeSave);
    fp.appendFilter("SQLite", "*.sqlite");
    fp.defaultString = "ReplyRobot_Backup.sqlite";
    if (fp.show() == fp.returnCancel || !fp.file) return;

    var file = fp.file.QueryInterface(Ci.nsIFile);
    //if file already exists delete it.
    if(file.exists())
      file.remove(true);
    //

    var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
    var dbConn = dbSvc.openDatabase(file);

    if (!dbConn.tableExists(DB_TABLE_NAME_V2))
      dbConn.createTable(DB_TABLE_NAME_V2, "userText TEXT, ctrl INTEGER, alt INTEGER, shift INTEGER, key INTEGER, type INTEGER, global INTEGER, rcv INTEGER");

    dbConn.beginTransaction();

    for(var i in this.allTextSetting){
      var stmt = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?)");

      stmt.bindUTF8StringParameter(0, this.allTextSetting[i].text);
      stmt.bindInt32Parameter(1, this.allTextSetting[i].ctrl ? 1 : 0); //bindNullParameter
      stmt.bindInt32Parameter(2, this.allTextSetting[i].alt ? 1 : 0);
      stmt.bindInt32Parameter(3, this.allTextSetting[i].shift ? 1 : 0);
      stmt.bindInt32Parameter(4, this.allTextSetting[i].key);
      stmt.bindInt32Parameter(5, this.allTextSetting[i].type);
      stmt.bindInt32Parameter(6, this.allTextSetting[i].global);
      stmt.bindInt32Parameter(7, this.allTextSetting[i].rcv);
      try {
        stmt.execute();
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    dbConn.commitTransaction();

    if(dbConn )
    {
      dbConn.close();
      dbConn = null;
    }
  },

  addTextToList: function(list, text, hotkeyText) {
    var list = document.getElementById('TextList');

    var row = document.createElement('listitem');
    var cell = document.createElement('listcell');
    cell.setAttribute('label', text);
    row.appendChild(cell);
    cell = document.createElement('listcell');
    cell.setAttribute('label', hotkeyText);
    row.appendChild(cell);

    //row.setAttribute('label', text);
    list.appendChild(row);
  },

  modifyListText: function(list, idx, text, hotkeyText) {
    //list.selectedItems[0].childNodes[0].setAttribute('label', text);
    //list.selectedItems[0].childNodes[1].setAttribute('label', hotkeyText);
    list.getItemAtIndex(idx).childNodes[0].setAttribute('label', text);
    list.getItemAtIndex(idx).childNodes[1].setAttribute('label', hotkeyText);
  },

  textMoveUp: function() {
    var list = document.getElementById('TextList');
    var idx = list.getIndexOfItem(list.selectedItems[0]);

      //var list = document.getElementById('treeSiteList');
      //var idx = list.currentIndex;
    if(idx==0)
      return false;
    this.textSwap(idx, idx-1);
    this.listTextSwap(idx, idx-1);
    list.selectedIndex = idx-1;
    list.ensureIndexIsVisible(idx-1);
    //list.view.selection.select(idx-1);
    //list.boxObject.ensureRowIsVisible(idx-1);
    this.updateButtonState();
    return true;
  },

  textMoveDown: function() {
    var list = document.getElementById('TextList');
    var idx = list.getIndexOfItem(list.selectedItems[0]);

      //var list = document.getElementById('treeSiteList');
      //var idx = list.currentIndex;
    if(idx>=list.itemCount)
      return false;
    this.textSwap(idx, idx+1);
    this.listTextSwap(idx, idx+1);
    list.selectedIndex = idx+1;
    list.ensureIndexIsVisible(idx+1);
    //list.view.selection.select(idx+1);
    //list.boxObject.ensureRowIsVisible(idx+1);

    this.updateButtonState();
    return true;
  },

  textSwap: function(idx1, idx2) {
    var tempText = this.allTextSetting[idx1];
    this.allTextSetting[idx1] = this.allTextSetting[idx2];
    this.allTextSetting[idx2] = tempText;
  },

  listTextSwap: function(idx1, idx2) {
    var list = document.getElementById('TextList');
    var count = list.itemCount;
    //var list = document.getElementById('treeSiteList');
    //var list2 = document.getElementById('siteItems');
    //var count = list.view.rowCount;

    var text1 = list.getItemAtIndex(idx1).childNodes[0].getAttribute('label');
    var hotkey1 = list.getItemAtIndex(idx1).childNodes[1].getAttribute('label');
    var text2 = list.getItemAtIndex(idx2).childNodes[0].getAttribute('label');
    var hotkey2 = list.getItemAtIndex(idx2).childNodes[1].getAttribute('label');

    this.modifyListText(list, idx1, text2, hotkey2);
    this.modifyListText(list, idx2, text1, hotkey1);
  },

  updateButtonState: function() {

    var list = document.getElementById('TextList');
    var btnMoveUp = document.getElementById('btnMoveUp');
    var btnMoveDown = document.getElementById('btnMoveDown');
    var btnDel = document.getElementById('btnDel');
    var btnModify = document.getElementById('btnModify');
    var btnExport = document.getElementById('btnExport');

    //move up/down - start
    var idx = list.currentIndex;
    if(idx==0 || list.itemCount<2)
      btnMoveUp.disabled = true;
    else
      btnMoveUp.disabled = false;

    if(idx==list.itemCount-1 || list.itemCount<2)
      btnMoveDown.disabled = true;
    else
      btnMoveDown.disabled = false;
    //move up/down - start

    //del - start
    btnDel.disabled = !(list.itemCount);
    //del - end

    //modify - start
    btnModify.disabled = !(list.itemCount);
    //modify - end

    //modify - start
    btnExport.disabled = !(list.itemCount);
    //modify - end
  }
}