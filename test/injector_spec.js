'use strict';

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
        
});

