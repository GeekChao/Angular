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
});

