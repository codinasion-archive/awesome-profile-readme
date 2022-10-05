// Learn more about Creating a JavaScript action
// https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action

// To call Github API
import fetch from "node-fetch";

// To manage files (save)
import fs from "fs";

// For input and output of github workflow
import core from "@actions/core";

// To take profile README screenshots
import chrome from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";

// main function
(async () => {
  try {
    console.log("Hii there !!!");

    // get action default data
    const owner = await core.getInput("owner");
    const repo = await core.getInput("repo");
    const username = await core.getInput("username");
    const token = await core.getInput("token");

    // get issue data
    const issue_body = await core.getInput("issue-body");
    const issue_link = await core.getInput("issue-link");
    const get_issue_data = await core.getInput("get-issue-data");

    // get trigger conditions
    const generate_image = await core.getInput("generate-image");
    const generate_json = await core.getInput("generate-json");

    if (get_issue_data === "true") {
      // get username from issue body
      const get_username = issue_body.replace("### Username", "").trim();
      await console.log("username => ", get_username);

      // check if username is valid
      const response = await fetch(
        `https://api.github.com/users/${get_username}`,
        {
          headers: {
            Authorization: `token ${token}`,
          },
        }
      );
      const userData = await response.json();
      if (response.status === 200) {
        await console.log("username is valid");
        core.setOutput("username", userData.login);
        core.setOutput("username_valid", "true");
      } else {
        await console.log("username is invalid !!!");
        core.setOutput("username", get_username);
        core.setOutput("username_valid", "false");
      }
    }

    // generate image
    if (generate_image === "true") {
      await console.log("username => ", username);

      // create folder 'images' if not exists
      const image_path = `images`;
      fs.mkdirSync(image_path);

      await console.log("Generating image...");
      await generateImage(username);
    }

    // generate json
    if (generate_json === "true") {
      await console.log("username => ", username);

      await console.log("Generating json...");

      // fetch latest image commit sha
      const imageCommitSha = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/image`,
        {
          method: "GET",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
        }
      ).then((res) => res.json());

      // fetch latest readme commit sha
      const readmeCommitSha = await fetch(
        `https://api.github.com/repos/${username}/${username}/commits`,
        {
          method: "GET",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
        .then((res) => res.json())
        .then((res) => res[0]);

      await console.log(
        "Output Image => ",
        `https://github.com/${owner}/${repo}/blob/${imageCommitSha.sha}/${username}.png`
      );

      await console.log(
        "Raw Image => ",
        `https://raw.githubusercontent.com/${owner}/${repo}/${imageCommitSha.sha}/${username}.png`
      );

      // create folder 'profiles' if not exists
      const profile_path = `profiles`;
      fs.mkdirSync(profile_path, { recursive: true });

      await console.log("Generating profile data...");
      const profile_data = {
        username: username,
        issue_url: `${issue_link}`,
        readme_url: `https://github.com/${username}/${username}/blob/${readmeCommitSha.sha}/README.md`,
        readme_image: `https://raw.githubusercontent.com/${owner}/${repo}/${imageCommitSha.sha}/${username}.png`,
        time: new Date().toISOString(),
      };

      await console.log("Saving profile data...");
      fs.writeFileSync(
        `${profile_path}/${username}.json`,
        JSON.stringify(profile_data)
      );

      core.setOutput(
        "readme_image",
        `https://raw.githubusercontent.com/${owner}/${repo}/${imageCommitSha.sha}/${username}.png`
      );
    }

    // end of main function
  } catch (e) {
    core.setFailed(`Action failed with "${e.message}"`);
  }
})();

// Generate Image Function
async function generateImage(username) {
  try {
    const options = process.env.AWS_REGION
      ? {
          args: chrome.args,
          executablePath: await chrome.executablePath,
          headless: chrome.headless,
        }
      : {
          args: [],
          executablePath:
            process.platform === "win32"
              ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
              : process.platform === "linux"
              ? "/usr/bin/google-chrome"
              : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        };

    await console.log("launching browser");
    const browser = await puppeteer.launch(options);

    await console.log("creating page");
    const page = await browser.newPage();

    await console.log("setting viewport");
    await page.setViewport({ width: 1024, height: 512 });

    await console.log("opening page");
    await page.goto(`http://github.com/${username}/`, {
      waitUntil: "networkidle0",
    });

    if (
      await page.$(
        // "#js-pjax-container > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
        "body > div.application-main > main > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
      )
    ) {
      // README.md found :)
      await console.log("README.md found :)");

      await console.log("wait for readme load");
      await page.waitForSelector(
        // "#js-pjax-container > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
        "body > div.application-main > main > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
      );

      const profile_readme = await page.$(
        // "#js-pjax-container > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
        "body > div.application-main > main > div.container-xl.px-3.px-md-4.px-lg-5 > div > div.Layout-main > div:nth-child(2) > div > div.Box.mt-4 > div"
      );

      await console.log("screenshotting");
      await profile_readme.screenshot({
        path: `images/${username}.png`,
        type: "png",
      });

      // README.md found :)
      core.setOutput("readme_valid", "true");
    } else {
      // README.md not found :(
      await console.log("README.md not found :( !!!");
      core.setOutput("readme_valid", "false");
    }

    await console.log("closing page");
    await page.close();

    await console.log("closing browser");
    await browser.close();
  } catch (error) {
    await console.log(`error occured !!! for ${username}.png`);
    await console.log(error);
  }
}
