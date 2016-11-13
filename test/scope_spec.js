'use strict';

var _ = require('lodash');
var Scope = require('../src/scope');

describe('Scope', function(){

    it('can be constructed and used as an object', function(){
        var scope = new Scope();
        scope.aProperty = 1;
        expect(scope.aProperty).toBe(1);
    });

    describe('digest', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('calls the listener function of a watch on first $digest', function(){
            var watchFn = function() { return 'wat'; };
            var listenFn = jasmine.createSpy();
            scope.$watch(watchFn, listenFn);

            scope.$digest();

            expect(listenFn).toHaveBeenCalled();
        });

        it('calls the watch function with the scope as the argument', function(){
            var watchFn = jasmine.createSpy();
            var listenFn = function() {};
            scope.$watch(watchFn, listenFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('calls the listener function when the watch vaule changes', function(){
            scope.someValue = 'a';
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { scope.counter++; }
            );

            expect(scope.counter).toBe(0);

            scope.$digest();
            expect(scope.counter).toBe(1);
            
            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.someValue = 'b';
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it('calls listener when watch value is first undefined', function(){
            scope.counter = 0;

            scope.$watch(
                function watchFn(scope){ return scope.someValue; },
                function listenFn(newValue, oldValue, scope){ scope.counter++; }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);       
        });

        it('calls listener with new value as old value the first time', function(){
            scope.someValue = 123;
            var oldValueGiven;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
            );

            scope.$digest();
            expect(oldValueGiven).toBe(123);
        });

        it('may have watchers that omit the listener function', function(){
            var watchFn = jasmine.createSpy().and.returnValue('something');
            scope.$watch(watchFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalled();
        });

        it('triggers chained watchers in the same digest', function(){
            scope.name = 'Jane';

            scope.$watch(
                function(scope) { return scope.nameUpper; },
                function(newValue, oldValue, scope) {
                    if(newValue){
                        scope.initial = newValue.substring(0, 1) + '.';
                    }
                }
            );

            scope.$watch(
                function(scope) { return scope.name; },
                function(newValue, oldValue, scope){
                  if(newValue){
                      scope.nameUpper = newValue.toUpperCase();
                  }  
                } 
            );

            scope.$digest();
            expect(scope.initial).toBe('J.');

            scope.name = 'Bob';
            scope.$digest();
            expect(scope.initial).toBe('B.');
        });

        it('gives up on the watches after 10 iterations', function(){
            scope.counterA = 0;
            scope.counterB = 0;

            scope.$watch(
                function(scope) { return scope.counterA; },
                function(newValue, oldValue, scope) { scope.counterB++; }
            );

            scope.$watch(
                function(scope) { return scope.counterB; },
                function(newValue, oldValue, scope) { scope.counterA++; }
            );

            expect(function() { scope.$digest(); }).toThrow();
        });

        it('ends the digest when the last watch is clean', function(){
            scope.array = _.range(100);
            var watchExecutions = 0;

            _.times(100, function(i){
                scope.$watch(
                    function(scope) { watchExecutions++; return scope.array[i]; },
                    function(newValue, oldValue, scope) { }
                );
            });

            scope.$digest();
            expect(watchExecutions).toBe(200);

            scope.array[0] = 420;
            scope.$digest();
            expect(watchExecutions).toBe(301);
        });

        it('compares based on value if enabled', function(){
            scope.aValue = [1, 2, 3];
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope){ scope.counter++; },
                true
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it('correctly handles NaNs', function(){
            scope.number = 0 / 0;
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.number; },
                function(newValue, oldValue, scope){ scope.counter++; }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('allows destorying a $watch with a removal function', function(){
            scope.aValue = 'abc';
            scope.counter = 0;

            var destoryWatch = scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) { scope.counter++; }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue= 'def';
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.aValue = 'ghi';
            destoryWatch();
            scope.$digest();
            expect(scope.counter).toBe(2);
        });
    });

    describe('$eval', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('executes $eval function and returns result', function(){
            scope.aValue = 42;

            var result = scope.$eval(function(scope){
                return scope.aValue;
            });

            expect(result).toBe(42);
        });

        it('passes the second $eval argument straight through', function(){
            scope.aValue = 42;

            var result = scope.$eval(function(scope, arg){
                return scope.aValue + arg;
            }, 2);

            expect(result).toBe(44);
        });
    });

    describe('$apply', function(){
        var scope;
        
        beforeEach(function(){
            scope = new Scope();
        });

        it('executes the given function and starts the digest', function(){
            scope.aValue = 'someValue';
            scope.counter = 0;

            scope.$watch(
                function(scope){
                    return scope.aValue;
                },
                function(newValue, oldValue, scope){
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$apply(function(scope){
                scope.aValue = 'abc';
            });
            expect(scope.counter).toBe(2);
        });
    });

    describe('$evalAsync', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('executes given funtion later in the same cycle', function(){
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;

            scope.$watch(
                function(scope){
                    return scope.aValue;
                }, 
                function(newValue, oldValue, scope){
                    scope.$evalAsync(function(scope){
                        scope.asyncEvaluated = true;
                    });
                    scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
                }
            );

            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmediately).toBe(false);
        });

        it('schedules a digest in $evalAsync', function(done){
            scope.aValue = 'abc';
            scope.counter = 0;

            scope.$watch(
                function(scope){
                    return scope.aValue;
                },
                function(newValue, oldValue, scope){
                    scope.counter++;
                }
            );

            scope.$evalAsync(function(){});

            expect(scope.counter).toBe(0);
            setTimeout(function(){
                expect(scope.counter).toBe(1);
                done();
            }, 50);
        });
    });

    describe('$applyAsync', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('allows async $apply with $applyAsync', function(done){
            scope.counter = 0;

            scope.$watch(
                function(scope){
                    return scope.aValue;
                },
                function(newValue, oldValue, scope){
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$applyAsync(function(scope){
                scope.aValue = 'abc';
            });
            expect(scope.counter).toBe(1);
            
            setTimeout(function() {
               expect(scope.counter).toBe(2);
               done();
            }, 50);
        });

        it('never executes $applyAsynced function in the same cycle', function(done){
            scope.aValue = [1, 2, 3];
            scope.asyncApplied = false;

            scope.$watch(
                function(scope){
                    return scope.aValue;
                },
                function(newValue, oldValue, scope){
                    scope.$applyAsync(function(scope){
                        scope.asyncApplied = true;
                    });
                }   
            );

            scope.$digest();
            expect(scope.asyncApplied).toBe(false);
            setTimeout(function() {
                expect(scope.asyncApplied).toBe(true);         
                done();       
            }, 50);
        });

        it('cancels and flushes $applyAsync if digested first', function(done){
            scope.counter = 0;

            scope.$watch(
                function(scope){
                    scope.counter++;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope){}
            );

            scope.$applyAsync(function(scope){
                scope.aValue = 'abc';
            });            
            scope.$applyAsync(function(scope){
                scope.aValue = 'def';
            });

            scope.$digest();
            expect(scope.counter).toBe(2);
            expect(scope.aValue).toEqual('def');

            setTimeout(function() {
                expect(scope.counter).toBe(2);
                done();
            }, 50);
        });
    });

    describe('$watchGroup', function(){
        var scope;
        beforeEach(function(){
            scope = new Scope();
        });

        it('takes watches as an array and calls listener with arrays', function(){
            var gotNewValues, gotOldValues;

            scope.aValue = 1;
            scope.anotherValue = 2;

            scope.$watchGroup([
                function(scope) { return scope.aValue; },
                function(scope) { return scope.anotherValue; }
            ], function(newValues, oldValues, scope){
                gotNewValues = newValues;
                gotOldValues = oldValues;
            });

            scope.$digest();
            expect(gotNewValues).toEqual([1, 2]);
            expect(gotOldValues).toEqual([1, 2]);
        });

        it('only calls listener once per digest', function(){
            var counter = 0;

            scope.aValue = 1;
            scope.anotherValue = 2;

            scope.$watchGroup([
                function(scope) { return scope.aValue; },
                function(scope) { return scope.anotherValue; }
            ], function(newValues, oldValues, scope){
                counter++;
            });

            scope.$digest();
            expect(counter).toEqual(1);
        });

        it('can be deregistered', function(){
            var counter = 0;

            scope.aValue = 1;
            scope.anotherValue = 2;

            var destoryGroup = scope.$watchGroup([
                function(scope) { return scope.aValue; },
                function(scope) { return scope.anotherValue; }
            ], function(newValues, oldValues, scope){
                counter++;
            });

            scope.$digest();

            scope.anotherValue = 3;
            destoryGroup();
            scope.$digest();

            expect(counter).toEqual(1);
        });

        it('does not call the zero-watch listener when deregistered first', function(){
            var counter = 0;

            var destoryGroup = scope.$watchGroup([], function(newValues, oldValues, scope){
                counter++;
            });

            destoryGroup();
            scope.$digest();

            expect(counter).toEqual(0);
        });
    });

    describe('inheritance', function(){

        it('digests its children', function(){
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = 'abc';
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope){
                    scope.aValueWas = newValue;
                }
            );

            parent.$digest();
            expect(child.aValueWas).toBe('abc');
        });

        it('schedules a digest from root on $evalAsync', function(done){
            var parent = new Scope();
            var child = parent.$new();
            var child2 = child.$new();

            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope){
                    scope.counter++;
                }
            );

            child2.$evalAsync(function(scope) {});

            setTimeout(function() {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        it('executes $applyAsync functions on isolated scope', function(){
            var parent = new Scope();
            var child = parent.$new(true);
            var applied = false;

            parent.$applyAsync(function() {
                applied = true;
            });

            child.$digest();
            expect(applied).toBe(true);
        });

        it('is no longer digested when $destory has been called', function(){
            var parent = new Scope();
            var child = parent.$new();

            child.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope){
                    scope.counter++;
                },
                true
            );

            parent.$digest();
            expect(child.counter).toBe(1);

            child.aValue.push(4);
            parent.$digest();
            expect(child.counter).toBe(2);

            child.$destory();
            child.aValue.push(5);
            parent.$digest();
            expect(child.counter).toBe(2);                        
        });
    });

    describe('$watchCollection', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('works like a normal watch for non-collections', function(){
            var valueProvided; 

            scope.aValue = 42;
            scope.counter = 0;

            scope.$watchCollection(
                function(scope){ return scope.aValue; },
                function(newValue, oldValue, scope){
                    valueProvided = newValue;
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
            expect(valueProvided).toBe(scope.aValue);

            scope.aValue = 43;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });
        
        it('notices an item replaced in an arguments object', function() {
            (function() {
                scope.arrayLike = arguments;
            })(1, 2, 3);
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arrayLike; },
                function(newValue, oldValue, scope) {
                scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arrayLike[1] = 42;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });       
    });

    describe('Events', function(){
        var parent;
        var scope;
        var child;
        var isolatedChild;

        beforeEach(function(){
            parent = new Scope();
            scope = parent.$new();
            child = scope.$new();
            isolatedChild = scope.$new(true);
        });

        it('allows registering listeners', function(){
            var listener1 = function() {};
            var listener2 = function() {};
            var listener3 = function() {};

            scope.$on('someEvent', listener1);
            scope.$on('someEvent', listener2);
            scope.$on('someOtherEvent', listener3);

            expect(scope.$$listeners).toEqual({
                someEvent: [listener1, listener2],
                someOtherEvent: [listener3]
            });
        });

        _.forEach(['$emit', '$broadcast'], function(method){
            it('call the listeners of the matching event on ' + method, function(){
                var listener1 = jasmine.createSpy();
                var listener2 = jasmine.createSpy();

                scope.$on('someEvent', listener1);
                scope.$on('someOtherEvent', listener2);
                scope[method]('someEvent');
                
                expect(listener1).toHaveBeenCalled();
                expect(listener2).not.toHaveBeenCalled();
            });

            it('passed additional arguments to listeners on ' + method, function(){
                var listener = jasmine.createSpy();
                scope.$on('someEvent', listener);

                scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');

                expect(listener.calls.mostRecent().args[1]).toEqual('and');
                expect(listener.calls.mostRecent().args[3]).toEqual('...');
            });

            it('does not skip the next listener when removed on ' + method, function(){
                var deregister;

                var listener = function(){
                    deregister();
                };
                var nextListner = jasmine.createSpy();

                deregister = scope.$on('someEvent', listener);
                scope.$on('someEvent', nextListner);
                scope[method]('someEvent');

                expect(nextListner).toHaveBeenCalled();
            });

            it('is sets defaultPrevented when preventDefault called on ' + method, function(){
                var listener = function(event){
                    event.preventDefault();
                };

                scope.$on('someEvent', listener);

                var event = scope[method]('someEvent');

                expect(event.defaultPrevented).toBe(true);
            });
        });

        it('propagates the same event up on $emit', function(){
            var parentListener = jasmine.createSpy();
            var scopeListener = jasmine.createSpy();

            parent.$on('someEvent', parentListener);
            scope.$on('someEvent', scopeListener);

            scope.$emit('someEvent');

            expect(parentListener).toHaveBeenCalled();
            expect(scopeListener).toHaveBeenCalled();

            var scopeEvent = scopeListener.calls.mostRecent().args[0];
            var parentEvent = parentListener.calls.mostRecent().args[0];

            expect(scopeEvent).toBe(parentEvent);
        });

        it('propagates the same event up on $broadcast', function(){
            var childListener = jasmine.createSpy();
            var scopeListener = jasmine.createSpy();

            child.$on('someEvent', childListener);
            scope.$on('someEvent', scopeListener);

            scope.$broadcast('someEvent');

            expect(childListener).toHaveBeenCalled();
            expect(scopeListener).toHaveBeenCalled();

            var scopeEvent = scopeListener.calls.mostRecent().args[0];
            var childEvent = childListener.calls.mostRecent().args[0];

            expect(scopeEvent).toBe(childEvent);
        });

        it('does not propagate to parents when stopped', function(){
            var scopeListener = function(event){
                event.stopPropagation();
            };
            var parentListener = jasmine.createSpy();

            scope.$on('someEvent', scopeListener);
            parent.$on('someEvent', parentListener);

            scope.$emit('someEvent');

            expect(parentListener).not.toHaveBeenCalled();
        });

    });
});