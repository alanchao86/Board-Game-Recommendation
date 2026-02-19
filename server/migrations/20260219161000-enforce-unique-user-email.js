'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Keep only the newest row per email (case-insensitive) to unblock uniqueness.
    await queryInterface.sequelize.query(`
      DELETE FROM users u
      USING users dupe
      WHERE LOWER(u.email) = LOWER(dupe.email)
        AND u.id < dupe.id
    `);

    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: false
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
      ON users (LOWER(email))
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS users_email_lower_unique
    `);

    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
  }
};
