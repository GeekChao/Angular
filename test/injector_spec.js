'use strict';

var _ = require('lodash');
var setupModuleLoader = require('../src/loader');
var createInjector = require('../src/injector');

describe('injector', function(){
    beforeEach(function(){
        delete window.angular;
        setupModuleLoader(window);
    });

    it('has a constant that has been registerded to a module', function(){
        var module = window.angular.module('myModule', []);
        module.constant('aConstant', 4);
        var injector = createInjector(['myModule']);
        expect(injector.has('aConstant')).toBe(true);
    });

    it('loads each module only once', function(){
        window.angular.module('myModule', ['myOtherModule']);
        window.angular.module('myOtherModule', ['myModule']);

        createInjector(['myModule']);
    });

    it('returns the array-style annotations of a function', function() {
      var injector = createInjector([]);

      var fn = ['a', 'b', function() { }];

      expect(injector.annotate(fn)).toEqual(['a', 'b']);
    });

    it('strips several comments from argument lists when parsing', function() {
      var injector = createInjector([]);

      var fn = function(a, /*b,*/ c/*, d*/) { };

      expect(injector.annotate(fn)).toEqual(['a', 'c']);
    });

    it('supports locals when instantiating', function() {
        var module = window.angular.module('myModule', []);
        module.constant('a', 1);
        module.constant('b', 2);
        var injector = createInjector(['myModule']);

        function Type(a, b) {
            this.result = a + b;
        }

        var instance = injector.instantiate(Type, {b: 3});
        expect(instance.result).toBe(4);
    });

    it('allows registering a provider and uses its $get', function(){
        var module = window.angular.module('myModule', []);
        module.provider('a', {
            $get: function(){
                return 42;
            }
        });

        var injector = createInjector(['myModule']);
        expect(injector.has('a')).toBe(true);
        expect(injector.get('a')).toBe(42);
    });

    it('injects the $get method of a provider lazily', function(){
        var module = window.angular.module('myModule', []);
        module.provider('b', {
            $get: function(a){
                return a + 2;
            }
        });
        module.provider('a', {
            $get: _.constant(1)
        });

        var injector = createInjector(['myModule']);
        
        expect(injector.get('b')).toBe(3);
    });    

    it('notifies the user about a circular dependency', function(){
        var module = window.angular.module('myModule', []);
        module.provider('a', {$get: function(b) {}});
        module.provider('b', {$get: function(c) {}});
        module.provider('c', {$get: function(a) {}});

        var injector = createInjector(['myModule']);

        expect(function(){
            injector.get('a');
        }).toThrowError('Circular dependency found: a <- c <- b <- a');
    });

    it('does not inject an instance to a provider constructor function', function() {
        var module = window.angular.module('myModule', []);

        module.provider('a', function AProvider() {
        this.$get = function() { return 1; };
        });

        module.provider('b', function BProvider(a) {
        this.$get = function() { return a; };
        });

        expect(function() {
        createInjector(['myModule']);
        }).toThrow();

    });

    it('does not inject a provider to a $get function', function() {
        var module = window.angular.module('myModule', []);

        module.provider('a', function AProvider() {
        this.$get = function() { return 1; };
        });
        module.provider('b', function BProvider() {
        this.$get = function(aProvider) { return aProvider.$get(); };
        });

        var injector = createInjector(['myModule']);

        expect(function() {
        injector.get('b');
        }).toThrow();
    });

    it('does not inject a provider to invoke', function() {
        var module = window.angular.module('myModule', []);

        module.provider('a', function AProvider() {
        this.$get = function() { return 1; };
        });

        var injector = createInjector(['myModule']);

        expect(function() {
        injector.invoke(function(aProvider) { });
        }).toThrow();
    });

    it('does not give access to providers through get', function() {
        var module = window.angular.module('myModule', []);

        module.provider('a', function AProvider() {
        this.$get = function() { return 1; };
        });

        var injector = createInjector(['myModule']);
        expect(function() {
        injector.get('aProvider');
        }).toThrow();
    });

    it('allows registering config blocks before providers', function(){
        var module = window.angular.module('myModule', []);

        module.config(function(aProvider){});
        module.provider('a', function(){
            this.$get = _.constant(42);
        });

        var injector = createInjector(['myModule']);
        
        expect(injector.get('a')).toBe(42);
    });

    it('runs a config block added during module registration', function(){
        var module = window.angular.module('myModule', [], function($provide){
            $provide.constant('a', 42);
        });

        var injector = createInjector(['myModule']);

        expect(injector.get('a')).toBe(42);
    });

    it('injects run blocks with the instance injector', function(){
        var module = window.angular.module('myModule', []);

        module.provider('a', {$get: _.constant(42)});

        var gotA;
        module.run(function(a){
            gotA = a;
        });

        createInjector(['myModule']);

        expect(gotA).toBe(42);
    });

    it('supports returning a run block from a function module', function(){
        var result;
        var functionModule = function($provide){
            $provide.constant('a', 42);
            return function(a){
                result = a;
            };
        };

        window.angular.module('myModule', [functionModule]);

        createInjector(['myModule']);

        expect(result).toBe(42);
    });

    it('injects a factory function with instances', function() {
        var module = window.angular.module('myModule', []);

        module.factory('a', function() { return 1; });
        module.factory('b', function(a) { return a + 2; });

        var injector = createInjector(['myModule']);

        expect(injector.get('b')).toBe(3);
    });

    it('does not make values available to config blocks', function() {
        var module = window.angular.module('myModule', []);

        module.value('a', 42);
        module.config(function(a) {
        });

        expect(function() {
        createInjector(['myModule']);
        }).toThrow();

    });

    it('injects service constructors with instances', function() {
        var module = window.angular.module('myModule', []);

        module.value('theValue', 42);
        module.service('aService', function MyService(theValue) {
        this.getValue = function() { return theValue; };
        });

        var injector = createInjector(['myModule']);

        expect(injector.get('aService').getValue()).toBe(42);
    });

    it('uses dependency injection with decorators', function() {
        var module = window.angular.module('myModule', []);
        module.factory('aValue', function() {
        return {};
        });
        module.constant('a', 42);
        module.decorator('aValue', function(a, $delegate) {
        $delegate.decoratedKey = a;
        });

        var injector = createInjector(['myModule']);

        expect(injector.get('aValue').decoratedKey).toBe(42);
    });
    
});

