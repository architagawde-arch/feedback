// 2 + 3. Models (validations & constraints) and associations - follows the ERD exactly
const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/db');

const define = (name, table, attrs, extra = {}) =>
  sequelize.define(name, attrs, { tableName: table, freezeTableName: true, timestamps: false, underscored: true, ...extra });
const pk = (name) => ({ [name]: { type: T.INTEGER, primaryKey: true, autoIncrement: true } });
const fk = (allowNull = false) => ({ type: T.INTEGER, allowNull });

const User = define('User', 'Users', {
  ...pk('user_id'),
  full_name: { type: T.STRING(100), allowNull: false, validate: { notEmpty: true, len: [2, 100] } },
  email: { type: T.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
  password_hash: { type: T.STRING(255), allowNull: false },
  status: { type: T.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
  created_at: { type: T.DATE, allowNull: false, defaultValue: T.NOW },
});

const Role = define('Role', 'Roles', {
  ...pk('role_id'),
  role_name: { type: T.ENUM('Student', 'Faculty', 'Admin'), allowNull: false, unique: true },
});

const UserRole = define('UserRole', 'UserRoles', {
  user_id: { ...fk(), primaryKey: true },
  role_id: { ...fk(), primaryKey: true },
});

const Department = define('Department', 'Departments', {
  ...pk('department_id'),
  department_name: { type: T.STRING(100), allowNull: false, unique: true, validate: { notEmpty: true } },
});

const Course = define('Course', 'Courses', {
  ...pk('course_id'),
  course_code: { type: T.STRING(30), allowNull: false, unique: true },
  course_name: { type: T.STRING(150), allowNull: false },
  department_id: fk(),
});

const Term = define('Term', 'Terms', {
  ...pk('term_id'),
  term_name: { type: T.STRING(50), allowNull: false },
  start_date: { type: T.DATEONLY, allowNull: false },
  end_date: { type: T.DATEONLY, allowNull: false },
}, {
  validate: { datesInOrder() { if (this.end_date < this.start_date) throw new Error('end_date must be after start_date'); } },
});

const CourseOffering = define('CourseOffering', 'CourseOfferings', {
  ...pk('offering_id'),
  course_id: fk(), term_id: fk(), instructor_id: fk(),
  section: { type: T.STRING(10), allowNull: false, defaultValue: 'A' },
});

const Enrollment = define('Enrollment', 'Enrollments', {
  ...pk('enrollment_id'),
  student_id: fk(), offering_id: fk(),
  enrolled_at: { type: T.DATEONLY, allowNull: false, defaultValue: T.NOW },
}, { indexes: [{ unique: true, fields: ['student_id', 'offering_id'], name: 'uq_student_offering' }] });

const FeedbackForm = define('FeedbackForm', 'FeedbackForms', {
  ...pk('form_id'),
  title: { type: T.STRING(200), allowNull: false, validate: { notEmpty: true } },
  description: { type: T.TEXT },
  form_type: { type: T.ENUM('Student', 'Faculty', 'All'), allowNull: false, defaultValue: 'Student' },
  target_type: { type: T.ENUM('Course', 'Instructor', 'Department', 'College'), allowNull: false },
  term_id: fk(true),
  created_by: fk(),
  start_at: { type: T.DATE, allowNull: false },
  end_at: { type: T.DATE, allowNull: false },
  is_anonymous: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  status: { type: T.ENUM('Draft', 'Published', 'Closed'), allowNull: false, defaultValue: 'Draft' },
}, {
  validate: { windowInOrder() { if (new Date(this.end_at) <= new Date(this.start_at)) throw new Error('end_at must be after start_at'); } },
});

const Question = define('Question', 'Questions', {
  ...pk('question_id'),
  form_id: fk(),
  question_text: { type: T.STRING(500), allowNull: false, validate: { notEmpty: true } },
  question_type: { type: T.ENUM('Rating', 'Text', 'Yes/No', 'Multiple Choice'), allowNull: false },
  is_required: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  display_order: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
});

const QuestionOption = define('QuestionOption', 'QuestionOptions', {
  ...pk('option_id'),
  question_id: fk(),
  option_text: { type: T.STRING(255), allowNull: false },
  option_value: { type: T.STRING(50) },
});

const FeedbackAssignment = define('FeedbackAssignment', 'FeedbackAssignments', {
  ...pk('assignment_id'),
  form_id: fk(), respondent_id: fk(), offering_id: fk(true),
  assigned_at: { type: T.DATE, allowNull: false, defaultValue: T.NOW },
  status: { type: T.ENUM('Pending', 'Completed'), allowNull: false, defaultValue: 'Pending' },
}, { indexes: [{ unique: true, fields: ['form_id', 'respondent_id', 'offering_id'], name: 'uq_form_respondent_offering' }] });

const FeedbackSubmission = define('FeedbackSubmission', 'FeedbackSubmissions', {
  ...pk('submission_id'),
  assignment_id: { ...fk(), unique: true },
  submitted_at: { type: T.DATE },
  status: { type: T.ENUM('Draft', 'Submitted'), allowNull: false, defaultValue: 'Submitted' },
});

const Answer = define('Answer', 'Answers', {
  ...pk('answer_id'),
  submission_id: fk(), question_id: fk(), option_id: fk(true),
  answer_text: { type: T.TEXT },
  rating_value: { type: T.INTEGER, validate: { min: 1, max: 5 } },
});

// ---- Associations ----
// M:N Users <-> Roles (junction UserRoles)
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id', otherKey: 'role_id', as: 'roles' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id', otherKey: 'user_id', as: 'users' });
// 1:M
Department.hasMany(Course, { foreignKey: 'department_id', as: 'courses' });
Course.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Course.hasMany(CourseOffering, { foreignKey: 'course_id', as: 'offerings' });
CourseOffering.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Term.hasMany(CourseOffering, { foreignKey: 'term_id', as: 'offerings' });
CourseOffering.belongsTo(Term, { foreignKey: 'term_id', as: 'term' });
User.hasMany(CourseOffering, { foreignKey: 'instructor_id', as: 'taughtOfferings' });
CourseOffering.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });
// M:N Users <-> CourseOfferings (junction Enrollments)
User.belongsToMany(CourseOffering, { through: Enrollment, foreignKey: 'student_id', otherKey: 'offering_id', as: 'enrolledOfferings' });
CourseOffering.belongsToMany(User, { through: Enrollment, foreignKey: 'offering_id', otherKey: 'student_id', as: 'students' });
Enrollment.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
Enrollment.belongsTo(CourseOffering, { foreignKey: 'offering_id', as: 'offering' });

User.hasMany(FeedbackForm, { foreignKey: 'created_by', as: 'createdForms' });
FeedbackForm.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Term.hasMany(FeedbackForm, { foreignKey: 'term_id', as: 'forms' });
FeedbackForm.belongsTo(Term, { foreignKey: 'term_id', as: 'term' });

FeedbackForm.hasMany(Question, { foreignKey: 'form_id', as: 'questions', onDelete: 'CASCADE' });
Question.belongsTo(FeedbackForm, { foreignKey: 'form_id', as: 'form' });
Question.hasMany(QuestionOption, { foreignKey: 'question_id', as: 'options', onDelete: 'CASCADE' });
QuestionOption.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

FeedbackForm.hasMany(FeedbackAssignment, { foreignKey: 'form_id', as: 'assignments', onDelete: 'CASCADE' });
FeedbackAssignment.belongsTo(FeedbackForm, { foreignKey: 'form_id', as: 'form' });
User.hasMany(FeedbackAssignment, { foreignKey: 'respondent_id', as: 'assignments' });
FeedbackAssignment.belongsTo(User, { foreignKey: 'respondent_id', as: 'respondent' });
CourseOffering.hasMany(FeedbackAssignment, { foreignKey: 'offering_id', as: 'assignments' });
FeedbackAssignment.belongsTo(CourseOffering, { foreignKey: 'offering_id', as: 'offering' });

FeedbackAssignment.hasOne(FeedbackSubmission, { foreignKey: 'assignment_id', as: 'submission', onDelete: 'CASCADE' });
FeedbackSubmission.belongsTo(FeedbackAssignment, { foreignKey: 'assignment_id', as: 'assignment' });
FeedbackSubmission.hasMany(Answer, { foreignKey: 'submission_id', as: 'answers', onDelete: 'CASCADE' });
Answer.belongsTo(FeedbackSubmission, { foreignKey: 'submission_id', as: 'submission' });
Question.hasMany(Answer, { foreignKey: 'question_id', as: 'answers' });
Answer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
QuestionOption.hasMany(Answer, { foreignKey: 'option_id', as: 'answers' });
Answer.belongsTo(QuestionOption, { foreignKey: 'option_id', as: 'option' });

module.exports = {
  sequelize, User, Role, UserRole, Department, Course, Term, CourseOffering, Enrollment,
  FeedbackForm, Question, QuestionOption, FeedbackAssignment, FeedbackSubmission, Answer,
};
