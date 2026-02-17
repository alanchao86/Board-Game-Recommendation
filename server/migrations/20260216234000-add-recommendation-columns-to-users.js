'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'preference', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'preference_list', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull: false,
      defaultValue: []
    });

    await queryInterface.addColumn('users', 'preference_list1', {
      type: Sequelize.ARRAY(Sequelize.BOOLEAN),
      allowNull: false,
      defaultValue: []
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'preference_list1');
    await queryInterface.removeColumn('users', 'preference_list');
    await queryInterface.removeColumn('users', 'preference');
  }
};
