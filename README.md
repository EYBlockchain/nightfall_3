# nightfall_3

### To setup the application

You need to run a setup script the first time that you use nightfall_3.  This will install all of the dependencies. We use GitHub packages and so you will have to create a Personal Access [Token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token), if you don't already have one, to pull down these packages.  Call it GPR_TOKEN:

```sh
export GPR_TOKEN=<my_personal_access_token_string>
```
You can put the above line in your `~/.bash_profile` file if you wish (and you are using bash!).

After that, run the setup script
```sh
./setup-nightfall
```

### To start the application

If running for first time, do the setup first as above and then run script
```sh
./start-nightfall
```
