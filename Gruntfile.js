'use strict';

module.exports = function(grunt) {

  grunt.initConfig({

    lambda_invoke: {
      default: {
        options: {
          event: grunt.option('event')
        }
      }
    },

    lambda_package: {
      default: {
        options: {
          include_time: false
        }
      }
    },

    lambda_deploy: {
      default: {
        profile: grunt.option('profile'),
        arn: grunt.option('arn')
      }
    }

  });

  grunt.loadNpmTasks('grunt-aws-lambda');

  grunt.registerTask('run', ['lambda_invoke']);

  grunt.registerTask('build', ['lambda_package']);

  grunt.registerTask('deploy', ['lambda_package', 'lambda_deploy']);

};
