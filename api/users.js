const { Router } = require('express');
const { ValidationError } = require('sequelize');

const { generateAuthToken, requireAuth, checkAdmin } = require('../lib/auth');
const { User, UserClientFields } = require('../models/user');
const { Course } = require('../models/course');
const bcrypt = require('bcryptjs');

const router = Router();

// POST /users - Create a new user
router.post('/', checkAdmin, async function (req, res) {
    if (req.role !== 'admin' && req.body.role !== 'student') {
        res.status(403).send({
            error: 'Invalid credentials',
        });
    } else {
        try {
            const user = await User.create(req.body, UserClientFields);
            res.status(201).send({ id: user.id });
        } catch (e) {
            if (e instanceof ValidationError) {
                res.status(400).send({ error: e.message });
            } else {
                throw e;
            }
        }
    }
});

// POST /users/login - Log in a user
router.post('/login', async function (req, res) {
    if (req.body && req.body.email && req.body.password) {
        const user = await User.findOne({ where: { email: req.body.email } });
        const authenticated =
            user && (await bcrypt.compare(req.body.password, user.password));
        if (authenticated) {
            const token = generateAuthToken(user.id, user.role);
            res.status(200).send({ token: token });
        } else {
            res.status(401).send({
                error: 'Invalid credentials or login info',
            });
        }
    } else {
        res.status(400).send({
            error: 'Request needs user ID and password.',
        });
    }
});

// GET /users/{id} - Fetch data about a specific user
router.get('/:userId', requireAuth, async function (req, res, next) {
    const userId = parseInt(req.params.userId);
    if (req.user !== userId && req.role !== 'admin') {
        res.status(403).send({
            error: 'Invalid credentials',
        });
    } else {
        const user = await User.findByPk(userId);
        if (user) {
            if (user.role === 'instructor') {
                const courses = await Course.findAll({
                    where: { instructorId: userId },
                });
                res.status(200).send({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    password: user.password,
                    role: user.role,
                    courses: courses,
                });
            } else if (user.role === 'student') {
                // https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/#eager-loading-with-many-to-many-relationships
                const student = await User.findOne({
                    where: { id: user.id },
                    include: {
                        model: Course,
                        through: {
                            attributes: [],
                        },
                    },
                });
                res.status(200).send({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    password: user.password,
                    role: user.role,
                    courses: student.courses,
                });
            } else {
                res.status(200).send({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    password: user.password,
                    role: user.role,
                });
            }
        } else {
            next();
        }
    }
});

module.exports = router;
