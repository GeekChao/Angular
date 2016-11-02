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
    this.$$lastDirtyWatch = null;

    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if(index >= 0){
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$digestOnce = function() {
    var self = this;
    var newValue, oldValue;
    var dirty;

    _.forEachRight(this.$$watchers, function(watcher){
        try {
            if(watcher){
                newValue = watcher.watchFn(self);
                oldValue = watcher.last;
                if(!self.$$areEqual(newValue, oldValue, watcher.valueEq)){
                    self.$$lastDirtyWatch = watcher;
                    watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                    watcher.listenFn(newValue, 
                    (oldValue === initWatchVal ? newValue : oldValue), 
                    self);
                    dirty = true;
                }else if(self.$$lastDirtyWatch == watcher){
                    return false;
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
    return dirty;
};

Scope.prototype.$digest = function(){
    var dirty;
    var ttl = 10;
    this.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if(this.$$applyAsyncId){
        clearTimeout(this.$$applyAsyncId);
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
        this.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr){
    var self = this;
    if(!this.$$phase && !this.$$asyncQueue.length){
        setTimeout(function() {
            if(self.$$asyncQueue.length){
                self.$digest();
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
    this.$$applyAsyncId = null;
};

Scope.prototype.$applyAsync = function(expr){
    var self = this;
    this.$$applyAsyncQueue.push(function(){
        self.$eval(expr);
    });
    if(this.$$applyAsyncId === null){
        this.$$applyAsyncId = setTimeout(function() {
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


module.exports = Scope;