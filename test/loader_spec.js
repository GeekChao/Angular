'use strict';

var setUpModuleLoader = require('../src/loader');

describe('setUpModuleLoader', function(){

    beforeEach(function(){
        delete window.angular;
    });

    it('creates angular just once', function(){
        setUpModuleLoader(window);
        var ng = window.angular;
        setUpModuleLoader(window);
        expect(ng).toBe(window.angular);
    });

    describe('modules', function(){
        beforeEach(function(){
            setUpModuleLoader(window);
        });

        it('allows getting a module', function(){
            var myModule = window.angular.module('myModule', []);
            var gotModule = window.angular.module('myModule');

            expect(gotModule).toBeDefined();
            expect(gotModule).toBe(myModule);
        });

        it('throws when trying to get a nonexistent module', function(){
            expect(function(){
                window.angular.module('myModule');
            }).toThrow();
        });
    });
});
