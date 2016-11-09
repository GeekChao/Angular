'use strict';

var _ = require('lodash');
function initWatchVal() { }

function Scope(){
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$postDigestQueue = [];
    this.$root = this;
    this.$$children = [];
    this.$$phase = null;
}

Scope.prototype.$watch = function(watchFn, listenFn, valueEq){
    var self = this;
    var watcher = {
        watchFn: watchFn,
        listenFn: listenFn || function() { },
        valueEq: !!valueEq,
        last: initWatchVal
    };
    this.$$watchers.unshift(watcher);
    this.$root.$$lastDirtyWatch = null;

    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if(index >= 0){
            self.$$watchers.splice(index, 1);
            self.$root.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$digestOnce = function() {
    var self = this;
    var dirty;
    var continueLoop = true;

    this.$$everyScope(function(scope){
        var newValue, oldValue;
        _.forEachRight(scope.$$watchers, function(watcher){
            try {
                if(watcher){
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;
                    if(!scope.$$areEqual(newValue, oldValue, watcher.valueEq)){
                        scope.$root.$$lastDirtyWatch = watcher;
                        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                        watcher.listenFn(newValue, 
                        (oldValue === initWatchVal ? newValue : oldValue), 
                        scope);
                        dirty = true;
                    }else if(scope.$root.$$lastDirtyWatch == watcher){
                        continueLoop = false;
                        return false;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });
        return continueLoop;
    });
    return dirty;
};

Scope.prototype.$digest = function(){
    var dirty;
    var ttl = 10;
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if(this.$root.$$applyAsyncId){
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do{
        try {
            while(this.$$asyncQueue.length){
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
            }
        } catch (e) {
            console.error(e);
        }
        dirty = this.$digestOnce();
        if((dirty || this.$$asyncQueue.length) && !(ttl--)){
            this.$clearPhase();
            throw '10 digest iterations reached';
        }
    }while(dirty || this.$$asyncQueue.length);

    this.$clearPhase();

    while(this.$$postDigestQueue.length){
        try {
            this.$$postDigestQueue.shift()();
        } catch (e) {
            console.error(e);
        }
    }
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq){
    if(valueEq){
        return _.isEqual(newValue, oldValue);
    } else{
        return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' &&
        isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$eval = function(expr, arg){
    return expr(this, arg);
};

Scope.prototype.$apply = function(expr){
    try{
        this.$beginPhase('$apply');
        return this.$eval(expr);
    }finally{
        this.$clearPhase();
        this.$root.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr){
    var self = this;
    if(!this.$$phase && !this.$$asyncQueue.length){
        setTimeout(function() {
            if(self.$$asyncQueue.length){
                self.$root.$digest();
            }
        }, 0);
    }
    this.$$asyncQueue.push({scope: this, expression: expr});
};

Scope.prototype.$$flushApplyAsync = function(){
    try {
        while(this.$$applyAsyncQueue.length){
            this.$$applyAsyncQueue.shift()();
        }
    } catch (e) {
        console.error(e);
    }
    this.$root.$$applyAsyncId = null;
};

Scope.prototype.$applyAsync = function(expr){
    var self = this;
    this.$$applyAsyncQueue.push(function(){
        self.$eval(expr);
    });
    if(this.$root.$$applyAsyncId === null){
        this.$root.$$applyAsyncId = setTimeout(function() {
            self.$apply(_.bind(self.$$flushApplyAsync, self));
        }, 0);
    }
};

Scope.prototype.$$postDigest = function(fn){
    this.$$postDigestQueue.push(fn);
};

Scope.prototype.$beginPhase = function(phase){
    if(this.$$phase){
        throw this.$$phase + 'already in progress.';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function(){
    this.$$phase = null;
};

Scope.prototype.$watchGroup = function(watchFns, listenFn){
    var self = this;
    var newValues = new Array(watchFns.length);
    var oldValues = new Array(watchFns.length);
    var changeReactionScheduled = false;
    var firstRun = true;

    if(watchFns.length === 0){
        var shouldCall = true;
        self.$evalAsync(function(){
            if(shouldCall){
              listenFn(newValues, newValues, self);   
            }
        });

        return function(){
            shouldCall = false;
        };
    }

    function watchGroupListener(){
        if(firstRun){
            firstRun = false;
            listenFn(newValues, newValues, self);
        }else{
            listenFn(newValues, oldValues, self);
        }
        changeReactionScheduled = false;
    }

    var destoryFunctions = _.map(watchFns, function(watchFn, i){
        return self.$watch(watchFn, function(newValue, oldValue){
            newValues[i] = newValue;
            oldValues[i] = oldValue;
            if(!changeReactionScheduled){
                changeReactionScheduled = true;
                self.$evalAsync(watchGroupListener);
            }
        });
    });

    return function(){
        _.forEach(destoryFunctions, function(destoryFunction){
            destoryFunction();
        });
    };
};

Scope.prototype.$new = function(isolated, parent){
    var child;
    parent = parent || this;

    if(isolated){
        child = new Scope();
        child.$root = parent.$root;
        child.$$asyncQueue = parent.$$asyncQueue;
        child.$$postDigestQueue = parent.$$postDigestQueue;
        child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    }else{
        var ChildScope = function() {};
        ChildScope.prototype = this;
        child = new ChildScope();
    }

    parent.$$children.push(child);
    child.$$watchers = [];
    child.$$children = [];
    child.$parent = parent;
    return child;
};

Scope.prototype.$$everyScope = function(fn){
    if(fn(this)){
        return this.$$children.every(function(child){
            return child.$$everyScope(fn);
        });
    }else{
        return false;
    }
};

Scope.prototype.$destory = function(){
    if(this.$parent){
        var siblings = this.$parent.$$children;
        var index = siblings.indexOf(this);
        if(index >= 0){
            siblings.splice(index , 1);
        }
    }
    
    this.$$watchers = null;
};

function isArrayLike(obj){
    if(_.isNull(obj) || _.isUndefined(obj)){
        return false;
    }
    
    var length = obj.length;
    return length === 0 || (_.isNumber(length) && length > 0 && (length - 1) in obj);
}

Scope.prototype.$watchCollection = function(watchFn, listenFn){
    var self = this;
    var newValue;
    var oldValue;
    var oldLength;
    var veryOldValue;
    var trackVeryOldValue = (listenFn.length > 1);
    var changeCount = 0;
    var firstRun = true;

    var internalWatchFn = function(scope){
        var newLength;
        newValue = watchFn(scope);

        if(_.isObject(newValue)){
            if(isArrayLike(newValue)){
                if(!_.isArray(oldValue)){
                    changeCount++;
                    oldValue = [];
                }
                if(newValue.length !== oldValue.length){
                    changeCount++;
                    oldValue.length = newValue.length;
                }
                _.forEach(newValue, function(newItem, i){ 
                    var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
                    if(!bothNaN && newItem !== oldValue[i]){
                        changeCount++;
                        oldValue[i] = newItem; 
                    }
                });
            }else{
                if(!_.isObject(oldValue) || isArrayLike(oldValue)){
                    changeCount++;
                    oldValue = {};
                    oldLength = 0;
                }
                
                newLength = 0;
                _.forOwn(newValue, function(newVal, key){
                    newLength++;
                    if(oldValue.hasOwnProperty(key)){ 
                        var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
                        if(!bothNaN && newVal !== oldValue[key]){ // replace
                            changeCount++;
                            oldValue[key] = newVal;
                        }
                    }else{ // add
                        changeCount++;
                        oldLength++;
                        oldValue[key] = newVal;
                    }
                });

                if(oldLength > newLength){  // delete
                    changeCount++;
                    _.forOwn(oldValue, function(oldVal, key){
                        if(!newValue.hasOwnProperty(key)){
                            oldLength--;
                            delete oldValue[key];
                        }
                    });
                }
            }
        }else{
            if(!self.$$areEqual(newValue, oldValue, false)){
                changeCount++;
            }
            oldValue = newValue; //reference copy for non-object value
        }

        return changeCount;
    };

    var internalListenFn = function(){
        if(firstRun){
            listenFn(newValue, newValue, self);
            firstRun = false;
        }else{
            listenFn(newValue, veryOldValue, self);
        }

        if(trackVeryOldValue){
            veryOldValue = _.clone(newValue);
        }
    };

    return this.$watch(internalWatchFn, internalListenFn);
};

module.exports = Scope;