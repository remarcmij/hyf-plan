#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');
const inquirer = require('inquirer');
const moment = require('moment');
const _ = require('lodash');
const glob = util.promisify(require('glob'));

const fsReadFile = util.promisify(fs.readFile);

const DATA_PATH = path.join(__dirname, '../data');
const TO_BE_ANNOUNCED = 'To be announced';

const dmyMoment = dateString => moment(dateString, 'DD-MM-YYYY');

function loadPlan(planName) {
  const data = fs.readFileSync(path.join(DATA_PATH, 'plans', `${planName}.yml`), 'utf8');
  return yaml.safeLoad(data);
}

function loadClass(className) {
  const data = fs.readFileSync(path.join(DATA_PATH, 'classes', `${className}.yml`), 'utf8');
  return yaml.safeLoad(data);
}

function loadTemplate(templateName) {
  return fs.readFileSync(path.join(DATA_PATH, 'templates', `${templateName}.md`), 'utf8');
}

function formatLectureDates(modulePlan) {
  const { lectureDates } = modulePlan;
  return lectureDates.reduce((obj, date, index) => {
    obj[`dateWeek${index + 1}`] = date;
    return obj;
  }, {});
}

function formatTeachers(modulePlan) {
  const { teachers } = modulePlan;
  if (!teachers || teachers.length === 0) {
    return `  - ${TO_BE_ANNOUNCED}`;
  }
  return modulePlan.teachers.map(teacher => `  - [ ] $${teacher}`).join('\n');
}

function formatStudents(classInfo) {
  const { students } = classInfo;
  return students.map(student => `    - [ ] $${student}`).join('\n');
}

async function getPlanChoices() {
  const filePaths = await glob(path.join(DATA_PATH, 'plans', '*.yml'));
  const planItems = await Promise.all(
    filePaths.map(async filePath => {
      const plan = await fsReadFile(filePath, 'utf8').then(data => yaml.safeLoad(data));
      return { filePath, plan };
    })
  );

  const today = moment();
  const futureItems = planItems.filter(item => {
    const startDate = dmyMoment(item.plan.lectureDates[0]);
    return startDate.isAfter(today);
  });

  futureItems.sort((a, b) => {
    const aDate = dmyMoment(a.plan.lectureDates[0]).valueOf();
    const bDate = dmyMoment(b.plan.lectureDates[0]).valueOf();
    return aDate - bDate;
  });

  return futureItems.map(
    item => `${path.basename(item.filePath, '.yml')} ${item.plan.lectureDates[0]}`
  );
}

(async () => {
  try {
    let planName;
    if (process.argv.length <= 2) {
      const choices = await getPlanChoices();
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'select',
          message: 'For which module do you want to generate a GitHub issue?',
          choices,
        },
      ]);
      [planName] = answer.select.split(' ');
    } else {
      planName = process.argv[2];
    }

    const modulePlan = loadPlan(planName);
    const [className, templateName] = planName.split('.');
    const classInfo = loadClass(className);
    const template = loadTemplate(templateName);
    const compiled = _.template(template);

    const lectureDates = formatLectureDates(modulePlan);
    const teachers = formatTeachers(modulePlan);
    const students = formatStudents(classInfo);

    const output = compiled({
      className: classInfo.name,
      teachers,
      students,
      ...lectureDates,
    });

    const outputFilename = `${planName}.issue.md`;
    fs.writeFileSync(outputFilename, output);
    console.log(`${outputFilename} created in current directory.`);
  } catch (err) {
    console.error(err);
  }
})();
