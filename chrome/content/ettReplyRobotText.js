function EttReplyRobotText(text, ctrl, alt, shift, key, type, global, rcv) {
    this.text = text;
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
    this.key = key;
    this.type = type;
    this.global = global;
    this.rcv = rcv;
}

EttReplyRobotText.prototype = {

  getHotkeyText: function() {
    var hotkeyText = '';
    if(this.key!=0)
    {
      if(this.ctrl)
      {
        hotkeyText += "Ctrl";
      }
      if(this.alt)
      {
        if(hotkeyText!="")
          hotkeyText += "+";
        hotkeyText += "Alt";
      }

      if(this.shift)
      {
        if(hotkeyText!="")
          hotkeyText += "+";
        hotkeyText += "Shift";
      }

      if(hotkeyText!="")
        hotkeyText += "+";
      hotkeyText += window.RRCodeToStr['s'+this.key];
    }
    return hotkeyText;
  }

}