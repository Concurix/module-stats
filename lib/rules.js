function Rules(rules){
  this.rules = rules;
}

Rules.prototype.wrapRequireReturn = function wrapRequireReturn(){
  if(!this.rules ){
    return true;
  }
  if( this.rules.skipWrapRequireReturn ){
    return false;
  } else {
    return true;
  }
}

Rules.prototype.wrapKey = function wrapKey(key){
  if( !this.rules ){
    return true;
  }
  if( this.rules.keys && this.rules.keys[key]){
    if( this.rules.keys[key].skip ){
      return false;
    } else if (this.rules.keys[key].whitelist ){
      return true;
    }
  }
  if( this.rules.all && this.rules.all.skipKeys ){
    return !this.rules.all.skipKeys;
  }
  return true;
}

Rules.prototype.handleArgs = function handleArgs(key){
  if( !this.rules ){
    return null;
  }
  if( this.rules.keys && this.rules.keys[key]){
    return this.rules.keys[key].handleArgs;
  }
  return null;
}

module.exports = Rules;