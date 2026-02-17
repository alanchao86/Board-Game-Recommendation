'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_ratings', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      game_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'board_games',
          key: 'bggid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      rating: {
        type: Sequelize.FLOAT,
        allowNull: false
      }
    });

    await queryInterface.addConstraint('user_ratings', {
      fields: ['user_id', 'game_id'],
      type: 'unique',
      name: 'unique_user_game_rating'
    });

    await queryInterface.addIndex('user_ratings', ['user_id']);
    await queryInterface.addIndex('user_ratings', ['game_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_ratings');
  }
};
