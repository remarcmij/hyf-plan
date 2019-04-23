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

const dmyMoment = dateString => moment(dateString, 'DD-MM-YYYY');

async function loadYaml(folderName, filename) {
  const data = await fsReadFile(path.join(DATA_PATH, folderName, `${filename}.yml`), 'utf8');
  return yaml.safeLoad(data);
}

async function tryLoadYaml(folderName, fileName) {
  try {
    return await loadYaml(folderName, fileName);
  } catch (_) {
    return {};
  }
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

function mergeTemplates(mainConfig, moduleConfig, classConfig, planConfig) {
  return [mainConfig, moduleConfig, classConfig, planConfig].reduce((prev, { templates }) => {
    if (templates) {
      prev = { ...prev, ...templates };
    }
    return prev;
  }, {});
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

    const [className, moduleName] = planName.split('.');

    const mainConfig = await loadYaml('config', 'config');
    const moduleConfig = await tryLoadYaml('modules', moduleName);
    const classConfig = await loadYaml('classes', className);
    const planConfig = await loadYaml('plans', planName);

    const templates = mergeTemplates(mainConfig, moduleConfig, classConfig, planConfig);

    const teachers = planConfig.teachers
      ? planConfig.teachers.map(teacher => replaceText(templates.teacher, { teacher })).join('\n')
      : '';

    const students = classConfig.students
      ? classConfig.students.map(student => replaceText(templates.student, { student })).join('\n')
      : '';

    const header =
      '## ' +
      replaceText(templates.header, {
        className: classConfig.name,
        moduleName: mainConfig.modules[moduleName],
        teachers,
      });

    const body = planConfig.lectureDates
      .map(
        (lectureDate, index) =>
          '\n### ' +
          replaceText(
            templates.week,
            {
              weekNum: index + 1,
              lectureDate,
              students,
            },
            ''
          )
      )
      .join('\n');

    const output = header + body + '\n' + (templates.footer || '');

    const outputFilename = `${planName}.issue.md`;
    fs.writeFileSync(outputFilename, output);
    console.log(`${outputFilename} created in current directory.`);
  } catch (err) {
    console.error(err);
  }
})();
