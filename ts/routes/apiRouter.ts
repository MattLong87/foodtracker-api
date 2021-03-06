import * as express from 'express';
export const router = express.Router();
import * as bcrypt from 'bcryptjs';
import { User } from '../models'

import * as passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as BearerStrategy } from 'passport-http-bearer';

passport.use(new LocalStrategy({ usernameField: 'email' }, (email: string, password: string, done) => {
    let user;
    User.findOne({ email: email.toLowerCase() })
        .exec()
        .then(_user => {
            user = _user;
            if (!user) {
                return done(null, false, { message: 'Email not found' });
            }
            return user.validatePassword(password);
        })
        .then(isValid => {
            if (!isValid) {
                return done(null, false, { message: 'Incorrect password' });
            }
            else {
                user.token = User.generateToken();
                user.save((err, updatedUser) => {
                    return done(null, updatedUser);
                })
            }
        })
}));

passport.use(new BearerStrategy(
    function (token, done) {
        User.findOne({ token: token }, function (err, user) {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            return done(null, user, { scope: 'all' });
        });
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user.apiRepr());
    })
})

//MIDDLEWARE
router.use(passport.initialize());

router.get('/', (req, res) => {
    res.send("foodtracker API");
});

router.post('/login', passport.authenticate('local'), (req, res) => {
    User.findById(req.user.id)
        .exec()
        .then(user => {
            res.send(user.apiRepr());
        })
});

//GET a user's information
router.get('/users/me', passport.authenticate('bearer', { session: false }), (req, res) => {
    //user is attached to request object by passport.deserializeUser
    User.findById(req.user.id)
        .exec()
        .then(user => {
            res.send(user.apiRepr());
        })
})

//POST to create a new user
router.post('/users', (req, res) => {
    //verify required fields are present
    const requiredFields = ["password", "email", "firstName", "lastName"];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!req.body[field]) {
            return res.json({ message: `Missing field: ${field}` });
        }
    }
    User.find({ email: req.body.email })
        .count()
        .exec()
        .then(count => {
            if (count > 0) {
                return res.status(422).json({ message: 'Email already registered' });
            }
            return User.hashPassword(req.body.password)
        })
        .then(hash => {
            return User.create({
                email: req.body.email.toLowerCase(),
                password: hash,
                created: Date.now(),
                name: {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName
                }
            })
        })
        .then(
        user => res.status(201).json(user.apiRepr())
        )
        .catch(err => {
            console.error(err);
            res.status(500).json({ message: 'Internal Server Error' });
        })
})

//POST to add a meal
router.post('/users/me/add-meal', passport.authenticate('bearer', { session: false }), (req, res) => {
    //verify required fields are present
    const requiredFields = ["time", "food", "notes", "pain"];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!req.body[field]) {
            return res.json({ message: `Missing field: ${field}` });
        }
    }
    let newMeal: object = {
        time: req.body.time,
        food: req.body.food,
        notes: req.body.notes,
        pain: req.body.pain
    };
    User.findOneAndUpdate({ email: req.user.email }, { $push: { meals: { $each: [newMeal], $position: 0 } } }, { new: true })
        .exec()
        .then((user) => {
            res.status(201).json(user.apiRepr());
        })
})

//DELETE a specific meal by ID
router.delete('/users/me/meals', passport.authenticate('bearer', { session: false }), (req, res) => {
    //verify required fields are present
    const requiredFields = ["mealId"];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!req.body[field]) {
            return res.json({ message: `Missing field: ${field}` });
        }
    }
    User.update({ email: req.user.email }, { $pull: { meals: { _id: req.body.mealId } } })
        .exec()
        .then(() => res.status(204).end())
})