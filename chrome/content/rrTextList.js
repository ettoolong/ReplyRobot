const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const DB_FILE_NAME = "ettreplyrobot.sqlite";
const DB_TABLE_NAME = "user_define_text_v2";

var RRTextList = {
  dirSvc_ : Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,
  allTextSetting_ : [],

  getDBConnection: function (aForceOpen) {
    if (!aForceOpen && !this.dbFile_.exists())
      return null;
    if (!this.dbConn_ || !this.dbConn_.connectionReady) {
      var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
      this.dbConn_ = dbSvc.openDatabase(this.dbFile_);
    }
    return this.dbConn_;
  },

  init: function () {
    this.dbFile_ = this.dirSvc_.get("ProfD", Ci.nsIFile);
    this.dbFile_.append(DB_FILE_NAME);
    var dbConn = this.getDBConnection(false);
    if (!dbConn || !dbConn.tableExists(DB_TABLE_NAME))
      return false;

    var list = document.getElementById('TextList');
    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME);
    try {
      while (stmt.executeStep())
      {
        //var idx     = stmt.getInt32(0);
        var text    = stmt.getUTF8String(0);
        var ctrl    = (stmt.getInt32(1)!=0);
        var alt     = (stmt.getInt32(2)!=0);
        var shift   = (stmt.getInt32(3)!=0);
        var key     = stmt.getInt32(4);
        var type    = stmt.getInt32(5);
        var global  = stmt.getInt32(6);
        var rcv     = stmt.getInt32(7);
        var newText = new EttReplyRobotText(text, ctrl, alt, shift, key, type, global, rcv);
        this.allTextSetting_.push(newText);
        this.addTextToList(list, text, newText.getHotkeyText());
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }

    if(list.itemCount)
    {
      list.selectedIndex = 0;
      document.getElementById('btnOK').disabled = false;
    }
    return true;
  },

  selChanged: function () {
    var list = document.getElementById('TextList');
    var preview = document.getElementById('textPreview');
    if(list.selectedItems.length)
    {
      preview.value = list.selectedItems[0].childNodes[0].getAttribute('label');
    }
  },

  onInputText: function () {
    var list = document.getElementById('TextList');
    if(list.selectedItems.length)
    {
      var idx = list.getIndexOfItem(list.selectedItems[0]);
      var retVals = window.arguments[0];
      retVals.selectedText = this.allTextSetting_[idx].text;
      retVals.type = this.allTextSetting_[idx].type;
      window.close();
    }
  },

  onCancelInput: function () {
    window.close();
  },

  addTextToList: function(list, text, hotkeyText) {
    var row = document.createElement('listitem');
    var cell = document.createElement('listcell');
    cell.setAttribute('label', text);
    row.appendChild(cell);
    cell = document.createElement('listcell');
    cell.setAttribute('label', hotkeyText);
    row.appendChild(cell);

    list.appendChild(row);
  },

  sendStrByHotkey: function(ctrl, alt, shift, km) {
    for(var i in this.allTextSetting_){
      if(this.allTextSetting_[i].key) // have hotkey
      {
        if(  this.allTextSetting_[i].ctrl == ctrl
          && this.allTextSetting_[i].alt == alt
          && this.allTextSetting_[i].shift == shift
          && this.allTextSetting_[i].key == km)
        {
          var retVals = window.arguments[0];
          retVals.selectedText = this.allTextSetting_[i].text;
          retVals.type = this.allTextSetting_[i].type;
          window.close();
        }
      }
    }
  },

  finish: function () {
    if(this.dbConn_)
    {
      this.dbConn_.close();
      this.dbConn_ = null;
    }
  }

};

var RRTextEventHandler = {
  charCodeMapping : null,
  keyCodeMapping : null,
  charCodeMappingMac : null,
  OS : Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS,

  init: function(_this) {

    _this.key_press ={
      view: this,
      handleEvent: function(event) {
        var km = 0;
        if(event.keyCode)
        {
          if(event.keyCode==27)
          {
            window.close();
            return;
          }
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
          RRTextList.sendStrByHotkey(event.ctrlKey, event.altKey, event.shiftKey, km);
        }

      }
    };
    window.addEventListener("keypress", _this.key_press, true);
    _this.charCodeMapping = window.CharCodeMapping;
    _this.keyCodeMapping = window.KeyCodeMapping;
    if(_this.OS=='Darwin')
      _this.charCodeMappingMac = window.CharCodeMappingMac;
  },

  uninit: function(_this) {
    window.removeEventListener("keypress", _this.key_press, true);
  }

};
//////////////////////////////////////////////////////////////////////////
window.addEventListener("load",   function() { RRTextEventHandler.init(RRTextEventHandler); },   false);
window.addEventListener("unload", function() { RRTextEventHandler.uninit(RRTextEventHandler); }, false);