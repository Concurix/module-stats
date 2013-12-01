function Rules(rules){
  this.rules = rules;
}

Rules.prototype.wrapRequireReturn = function wrapRequireReturn(){
  if(!this.rules ){
    return true;
  }
  if( this.rules.skipWrapRequireReturn ){
    return true;
  } else {
    return false;
  }
}

Rules.prototype.wrapKey = function wrapKey(key){
  if( !this.rules ){
    return true;
  }
  if( this.rules.keys && this.rules.keys[key]){
    console.log('got skip key for ', key);
    return !this.rules.keys[key].skip
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