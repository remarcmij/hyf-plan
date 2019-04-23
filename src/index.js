#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');
const inquirer = require('inquirer');
const moment = require('moment');
const glob = util.promisify(require('glob'));

const fsReadFile = util.promisify(fs.readFile);

const DATA_PATH = path.join(__dirname, '../data');

const TO_BE_ANNOUNCED = 'To be announced';

const dmyMoment = dateString => moment(dateString, 'DD-MM-YYYY');

async function loadYaml(folderName, filename) {
  const data = await fsReadFile(path.join(DATA_PATH, folderName, `${filename}.yml`), 'utf8');
  return yaml.safeLoad(data);
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

function replaceText(text, keyValuePairs) {
  return Object.entries(keyValuePairs).reduce((prev, [name, value]) => {
    const pattern = new RegExp(`{{${name}}}`, 'g');
    return prev.replace(pattern, value);
  }, text);
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

    const modulePlan = await loadYaml('plans', planName);
    const [className, moduleName] = planName.split('.');
    const classInfo = await loadYaml('classes', className);
    const config = await loadYaml('config', 'config');

    const teachers = modulePlan.teachers
      ? modulePlan.teachers
          .map(teacher => replaceText(config.templates.teacher, { teacher }))
          .join('\n')
      : TO_BE_ANNOUNCED;

    const students = classInfo.students
      .map(student => replaceText(config.templates.student, { student }))
      .join('\n');

    const header =
      '## ' +
      replaceText(config.templates.header, {
        className: classInfo.name,
        moduleName: config.modules[moduleName],
        teachers,
      });

    const body = modulePlan.lectureDates
      .map(
        (lectureDate, index) =>
          '\n### ' +
          replaceText(
            config.templates.week,
            {
              weekNum: index + 1,
              lectureDate,
              students,
            },
            ''
          )
      )
      .join('\n');

    const output = header + body + '\n' + config.templates.footer;

    const outputFilename = `${planName}.issue.md`;
    fs.writeFileSync(outputFilename, output);
    console.log(`${outputFilename} created in current directory.`);
  } catch (err) {
    console.error(err);
  }
})();
