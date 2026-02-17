'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('board_games', {
      bggid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      yearpublished: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      avgrating: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      minplayers: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      maxplayers: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      numuserratings: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      imagepath: {
        type: Sequelize.TEXT,
        allowNull: true
      }
    });

    await queryInterface.addIndex('board_games', ['name']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('board_games');
  }
};
